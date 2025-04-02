# Automated Job Application System

This project provides a tool to automate the job application process using resume parsing 
and web automation. It consists of two main components:

1. A command-line application for resume parsing and job application automation
2. A Chrome extension for easy browser-based job application filling

## Features

### Resume Parser
- Extracts personal information, contact details, education, work experience, skills, and languages from resumes
- Supports PDF, DOCX, and TXT file formats
- Identifies missing information and prompts users to fill in the gaps

### Job Application Bot
- Automates the form-filling process on job application websites
- Handles authentication for popular job sites (LinkedIn, Indeed, Glassdoor)
- Manages navigation through multi-page applications
- Uploads resume and other documents automatically
- Validates forms before submission
- Tracks application success/failure

### Chrome Extension
- Provides a user-friendly interface for the automation functionality
- Allows on-the-fly analysis of job application forms
- Automates form filling directly in the browser
- Manages user profile data for quick application submission

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)
- Playwright (for web automation)

### Command-Line Application

1. Clone this repository:
```bash
git clone https://github.com/yourusername/job-application-automation.git
cd job-application-automation
```

2. Install dependencies:
```bash
npm install
```

3. Make the main script executable:
```bash
chmod +x index.js
```

### Chrome Extension

1. Generate the extension files:
```bash
node index.js generate-extension
```

2. Install the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions`
   - Enable "Developer mode" by toggling the switch in the top-right corner
   - Click "Load unpacked" and select the `extension` directory created in the previous step
   - The Job Application Assistant extension should now be installed and visible in your browser toolbar

## Usage

### Command-Line Application

#### Parse Resume
```bash
node index.js parse-resume /path/to/your/resume.pdf
```
This will extract information from your resume and save it for future use. It will also prompt you for any missing information.

#### Apply to a Single Job
```bash
node index.js apply https://example.com/job-posting
```
This will launch a browser and attempt to automatically fill out the job application form.

#### Apply to Multiple Jobs
```bash
node index.js batch-apply job-list.txt
```
Where `job-list.txt` is a file containing job URLs, one per line. The application will attempt to apply to each job in sequence.

#### Update User Data
```bash
node index.js update-user-data
```
This will allow you to update your personal information, education, experience, skills, and other details used for job applications.

### Chrome Extension

1. Click on the Job Application Assistant icon in your browser toolbar to open the extension popup
2. In the "Profile" tab, upload your resume and parse it to extract your information
3. Edit your profile to add any missing information
4. When you're on a job application page:
   - Click "Analyze Page" to identify form fields
   - Click "Auto-Fill Application" to fill in the form with your information
   - Review the filled form and make any necessary adjustments before submitting

## Configuration

### Credentials
For automatic login to job sites, you'll need to provide your credentials. You can either:

1. Set them during the interactive prompt when parsing your resume
2. Update them using the `update-user-data` command
3. Enter them in the Chrome extension's settings

### File Paths
You can configure the paths to your resume, cover letter, and other documents:

1. During the interactive prompt when parsing your resume
2. Using the `update-user-data` command
3. In the Chrome extension's profile settings

## Development

### Project Structure
- `resumeParser.js` - Resume parsing functionality
- `jobApplicationBot.js` - Web automation for job applications
- `index.js` - Main CLI application
- `extension/` - Chrome extension files

### Adding Support for Additional Job Sites
To add support for additional job sites, modify the `jobApplicationBot.js` file to include site-specific login and form-filling logic.

### Extending Resume Parsing
To improve resume parsing capabilities, enhance the extraction methods in `resumeParser.js` or integrate with additional text analysis libraries.

## Security Notes
- Credentials are stored locally and are not transmitted to any external servers
- The Chrome extension operates entirely within your browser
- Always review auto-filled applications before submission to ensure accuracy

## Limitations
- Complex or unusual application forms may require manual intervention
- Some websites implement anti-bot measures that may prevent automatic form filling
- The effectiveness of resume parsing depends on the structure and format of your resume

## Future Enhancements
- AI-powered cover letter generation based on job descriptions
- Integration with job search APIs to automate finding and applying to relevant positions
- Improved form field detection using machine learning
- Support for more resume formats and languages
- Advanced tracking of application status and follow-ups
- Mobile app companion for on-the-go application management

## Troubleshooting

### Common Issues
- **Authentication failures**: Ensure your credentials are correct and update them if necessary
- **Form field detection issues**: Try the "Analyze Page" function again or manually identify fields
- **File upload problems**: Check file paths and ensure your browser has permissions to access files
- **Application submission errors**: Review the form for any required fields that weren't filled correctly

### Logs
- CLI application logs are stored in the `logs` directory
- Chrome extension errors are visible in the browser's developer console

## Privacy Considerations
This tool operates entirely on your local machine. Your personal data and credentials are stored locally and are not sent to any external servers. Always review filled applications before submission to ensure your information is presented correctly and appropriately.

## Contributing
Contributions to this project are welcome! Please feel free to submit pull requests or open issues for bugs, feature requests, or documentation improvements.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements
- [Playwright](https://playwright.dev/) for web automation capabilities
- [pdf-parse](https://www.npmjs.com/package/pdf-parse) and [mammoth](https://www.npmjs.com/package/mammoth) for document parsing
- [natural](https://www.npmjs.com/package/natural) for natural language processing
- [Commander.js](https://www.npmjs.com/package/commander) for command-line interface

## Contact
For questions, feedback, or issues, please open an issue on the GitHub repository or contact the maintainer directly.

---

Happy job hunting!