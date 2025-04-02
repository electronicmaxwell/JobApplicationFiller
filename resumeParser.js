// resumeParser.js
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const NLP = require('natural');
const tokenizer = new NLP.WordTokenizer();

class ResumeParser {
  constructor() {
    this.userData = {
      personalInfo: {
        fullName: null,
        email: null,
        phone: null,
        location: null,
        dateOfBirth: null
      },
      education: [],
      experience: [],
      skills: [],
      languages: [],
      certifications: []
    };
    
    this.missingFields = [];
  }

  async parseResume(filePath) {
    const fileExt = path.extname(filePath).toLowerCase();
    let text = '';
    
    try {
      if (fileExt === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        text = data.text;
      } else if (fileExt === '.docx') {
        const result = await mammoth.extractRawText({path: filePath});
        text = result.value;
      } else if (fileExt === '.txt') {
        text = fs.readFileSync(filePath, 'utf8');
      } else {
        throw new Error('Unsupported file format');
      }
      
      // Parse the extracted text
      await this.extractInformation(text);
      
      // Identify missing fields
      this.identifyMissingFields();
      
      return {
        userData: this.userData,
        missingFields: this.missingFields
      };
    } catch (error) {
      console.error('Error parsing resume:', error);
      throw error;
    }
  }

  async extractInformation(text) {
    // Extract personal information
    this.extractPersonalInfo(text);
    
    // Extract education information
    this.extractEducation(text);
    
    // Extract work experience
    this.extractExperience(text);
    
    // Extract skills
    this.extractSkills(text);
    
    // Extract languages
    this.extractLanguages(text);
    
    // Extract certifications
    this.extractCertifications(text);
  }

  extractPersonalInfo(text) {
    // Extract name (usually at the beginning of the resume)
    const nameRegex = /^([A-Z][a-z]+ [A-Z][a-z]+)/m;
    const nameMatch = text.match(nameRegex);
    if (nameMatch) {
      this.userData.personalInfo.fullName = nameMatch[1];
    }
    
    // Extract email
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    const emailMatch = text.match(emailRegex);
    if (emailMatch) {
      this.userData.personalInfo.email = emailMatch[0];
    }
    
    // Extract phone
    const phoneRegex = /\b(\+\d{1,3}[-\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;
    const phoneMatch = text.match(phoneRegex);
    if (phoneMatch) {
      this.userData.personalInfo.phone = phoneMatch[0];
    }
    
    // Extract location
    const locationRegex = /(?:Address|Location):\s*([^,\n]+,\s*[A-Za-z\s]+(?:,\s*[A-Z]{2})?)|\b([A-Za-z\s]+, [A-Z]{2})\b/i;
    const locationMatch = text.match(locationRegex);
    if (locationMatch) {
      this.userData.personalInfo.location = locationMatch[1] || locationMatch[2];
    }
    
    // Extract date of birth (if present)
    const dobRegex = /(?:Date of Birth|DOB|Born):\s*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i;
    const dobMatch = text.match(dobRegex);
    if (dobMatch) {
      this.userData.personalInfo.dateOfBirth = dobMatch[1];
    }
  }

  extractEducation(text) {
    // Look for education section
    const educationSectionRegex = /(?:EDUCATION|ACADEMIC BACKGROUND|QUALIFICATIONS)(?:[\s\S]*?)(?:EXPERIENCE|EMPLOYMENT|WORK|SKILLS|$)/i;
    const educationSection = text.match(educationSectionRegex);
    
    if (educationSection) {
      const eduText = educationSection[0];
      
      // Extract university/college names
      const universityRegex = /([A-Za-z\s]+University|College|Institute|School)(?:[\s\S]*?)(?:\d{4})/gi;
      let uniMatch;
      
      while ((uniMatch = universityRegex.exec(eduText)) !== null) {
        // Get the lines around the university match to extract degree and dates
        const contextLines = eduText.substring(Math.max(0, uniMatch.index - 100), 
                                              Math.min(eduText.length, uniMatch.index + 300));
        
        // Extract degree
        const degreeRegex = /(?:Bachelor|Master|Ph\.D|MBA|B\.S\.|M\.S\.|B\.A\.|M\.A\.|B\.Eng|M\.Eng|B\.Tech|M\.Tech)[^\n\r]*/i;
        const degreeMatch = contextLines.match(degreeRegex);
        
        // Extract dates
        const dateRegex = /(?:\d{4}\s*-\s*\d{4}|\d{4}\s*-\s*Present|\d{4})/i;
        const dateMatch = contextLines.match(dateRegex);
        
        // Extract GPA if available
        const gpaRegex = /GPA:?\s*([0-9](?:\.[0-9]+)?)\s*\/?\s*([0-9](?:\.[0-9]+)?)?/i;
        const gpaMatch = contextLines.match(gpaRegex);
        
        this.userData.education.push({
          institution: uniMatch[0].trim(),
          degree: degreeMatch ? degreeMatch[0].trim() : null,
          dates: dateMatch ? dateMatch[0].trim() : null,
          gpa: gpaMatch ? gpaMatch[1] + (gpaMatch[2] ? '/' + gpaMatch[2] : '') : null
        });
      }
    }
  }

  extractExperience(text) {
    // Look for experience section
    const experienceSectionRegex = /(?:EXPERIENCE|EMPLOYMENT|WORK HISTORY|PROFESSIONAL BACKGROUND)(?:[\s\S]*?)(?:EDUCATION|SKILLS|AWARDS|LANGUAGES|$)/i;
    const experienceSection = text.match(experienceSectionRegex);
    
    if (experienceSection) {
      const expText = experienceSection[0];
      
      // Break into company entries
      const companyRegex = /([A-Za-z0-9\s,\.]+)(?:[\s\S]*?)(?:\d{4}\s*-\s*(?:\d{4}|Present))/gi;
      let companyMatch;
      
      while ((companyMatch = companyRegex.exec(expText)) !== null) {
        // Get the lines around the company match to extract role and dates
        const contextLines = expText.substring(Math.max(0, companyMatch.index - 50), 
                                             Math.min(expText.length, companyMatch.index + 400));
        
        // Extract job title
        const titleRegex = /(?:[\n\r]|^)([A-Za-z\s]+)(?:[\n\r]|$)/i;
        const titleMatch = contextLines.match(titleRegex);
        
        // Extract dates
        const dateRegex = /(?:\d{4}\s*-\s*\d{4}|\d{4}\s*-\s*Present|\d{4})/i;
        const dateMatch = contextLines.match(dateRegex);
        
        // Extract description
        const descStart = contextLines.indexOf(dateMatch ? dateMatch[0] : titleMatch ? titleMatch[0] : '');
        const description = descStart > -1 ? contextLines.substring(descStart + 20).trim() : '';
        
        this.userData.experience.push({
          company: companyMatch[0].trim(),
          title: titleMatch ? titleMatch[1].trim() : null,
          dates: dateMatch ? dateMatch[0].trim() : null,
          description: description.substring(0, 300) // Limit description length
        });
      }
    }
  }

  extractSkills(text) {
    // Look for skills section
    const skillsSectionRegex = /(?:SKILLS|TECHNICAL SKILLS|CORE COMPETENCIES)(?:[\s\S]*?)(?:LANGUAGES|EXPERIENCE|EDUCATION|CERTIFICATIONS|$)/i;
    const skillsSection = text.match(skillsSectionRegex);
    
    if (skillsSection) {
      const skillsText = skillsSection[0];
      
      // Extract skills - look for comma or bullet separated lists
      const skillsList = skillsText.split(/[,•·]/).map(skill => skill.trim())
        .filter(skill => skill.length > 0 && !/^(?:LANGUAGES|EXPERIENCE|EDUCATION|CERTIFICATIONS)$/i.test(skill));
      
      this.userData.skills = [...new Set(skillsList)]; // Remove duplicates
    }
  }

  extractLanguages(text) {
    // Look for languages section or mentions of languages in the text
    const languageSectionRegex = /(?:LANGUAGES|LANGUAGE PROFICIENCY)(?:[\s\S]*?)(?:SKILLS|EXPERIENCE|EDUCATION|CERTIFICATIONS|$)/i;
    const languageSection = text.match(languageSectionRegex);
    
    // List of common languages to look for
    const commonLanguages = [
      'English', 'Spanish', 'French', 'German', 'Italian', 'Chinese', 'Japanese',
      'Russian', 'Arabic', 'Portuguese', 'Hindi', 'Bengali', 'Urdu', 'Dutch', 'Turkish'
    ];
    
    if (languageSection) {
      const langText = languageSection[0];
      
      // Extract languages - look for language names followed by level
      commonLanguages.forEach(language => {
        const langRegex = new RegExp(`${language}[\\s\\S]*?(?:fluent|native|professional|beginner|intermediate|advanced|proficient|basic)`, 'i');
        const langMatch = langText.match(langRegex);
        
        if (langMatch) {
          this.userData.languages.push({
            language: language,
            proficiency: langMatch[0].replace(language, '').trim()
          });
        } else if (langText.includes(language)) {
          this.userData.languages.push({
            language: language,
            proficiency: 'Not specified'
          });
        }
      });
    } else {
      // If no dedicated language section, look for language mentions in the whole text
      commonLanguages.forEach(language => {
        if (text.includes(language)) {
          // Check if there's a proficiency level near the language mention
          const langContextRegex = new RegExp(`${language}[\\s\\S]{0,30}(?:fluent|native|professional|beginner|intermediate|advanced|proficient|basic)`, 'i');
          const langContextMatch = text.match(langContextRegex);
          
          if (langContextMatch) {
            const proficiencyMatch = langContextMatch[0].match(/(?:fluent|native|professional|beginner|intermediate|advanced|proficient|basic)/i);
            this.userData.languages.push({
              language: language,
              proficiency: proficiencyMatch ? proficiencyMatch[0].trim() : 'Not specified'
            });
          }
        }
      });
    }
  }

  extractCertifications(text) {
    // Look for certifications section
    const certSectionRegex = /(?:CERTIFICATIONS|CERTIFICATES|LICENSES)(?:[\s\S]*?)(?:EDUCATION|EXPERIENCE|SKILLS|LANGUAGES|$)/i;
    const certSection = text.match(certSectionRegex);
    
    if (certSection) {
      const certText = certSection[0];
      
      // Extract certification entries - typically they have a name and possibly a date
      const certRegex = /([A-Za-z\s]+(?:Certification|Certificate|License))(?:[\s\S]*?)(?:\d{4}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})?/gi;
      let certMatch;
      
      while ((certMatch = certRegex.exec(certText)) !== null) {
        // Get the lines around the certification match to extract date
        const contextLines = certText.substring(Math.max(0, certMatch.index - 50), 
                                              Math.min(certText.length, certMatch.index + 200));
        
        // Extract date
        const dateRegex = /(?:\d{4}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})/i;
        const dateMatch = contextLines.match(dateRegex);
        
        // Extract issuer
        const issuerRegex = /(?:issued by|from|through)\s+([A-Za-z\s]+)/i;
        const issuerMatch = contextLines.match(issuerRegex);
        
        this.userData.certifications.push({
          name: certMatch[1].trim(),
          date: dateMatch ? dateMatch[0].trim() : null,
          issuer: issuerMatch ? issuerMatch[1].trim() : null
        });
      }
    }
  }

  identifyMissingFields() {
    // Convert the extracted text to a string for checking
    const resumeText = JSON.stringify(this.userData).toLowerCase();
    
    // Check personal information
    for (const [key, value] of Object.entries(this.userData.personalInfo)) {
      if (!value) {
        this.missingFields.push(key);
      }
    }
    
    // Check if education is missing
    if (this.userData.education.length === 0) {
      this.missingFields.push('education');
    } else {
      // Check if degrees are missing
      const incompleteEducation = this.userData.education.filter(edu => !edu.degree || !edu.dates);
      if (incompleteEducation.length > 0) {
        this.missingFields.push('completeEducationDetails');
      }
    }
    
    // Check if work experience is missing
    if (this.userData.experience.length === 0) {
      this.missingFields.push('workExperience');
    } else {
      // Check if job titles or dates are missing
      const incompleteExperience = this.userData.experience.filter(exp => !exp.title || !exp.dates);
      if (incompleteExperience.length > 0) {
        this.missingFields.push('completeWorkExperienceDetails');
      }
    }
    
    // Check if skills are missing
    if (this.userData.skills.length === 0) {
      this.missingFields.push('skills');
    }
    
    // Check if languages are missing
    if (this.userData.languages.length === 0) {
      this.missingFields.push('languages');
    }
    
    // Additional fields that are typically not in resumes but might be needed for job applications
    this.missingFields.push('references'); // References are usually not included in resumes
    
    // Check for citizenship/work authorization status
    if (!resumeText.match(/(?:citizen|permanent resident|work authorization|visa)/i)) {
      this.missingFields.push('workAuthorizationStatus');
    }
    
    // Check for social media profiles
    if (!resumeText.match(/(?:linkedin|github|twitter|facebook|instagram)/i)) {
      this.missingFields.push('socialMediaProfiles');
    }
  }
}

module.exports = ResumeParser;
