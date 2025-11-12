# MedicationRunner Website

This website provides setup instructions and feedback viewing capabilities for the MedicationRunner app.

## Features

1. **Setup Instructions**: Comprehensive guide on how to set up and use the MedicationRunner app
2. **Feedback Viewer**: View and analyze user feedback exported from the app

## Usage

### Local Development

1. Open `index.html` in a web browser
2. Navigate between "Setup Instructions" and "View Feedback" tabs
3. For feedback viewing:
   - Export feedback from the app using the "Export All" button
   - Upload the exported text file using the "Choose File" button
   - View statistics and individual feedback entries

### Deployment

You can deploy this website to any static hosting service:

- **GitHub Pages**: Push to a repository and enable GitHub Pages
- **Netlify**: Drag and drop the `website` folder to Netlify
- **Vercel**: Deploy as a static site
- **Any web server**: Upload the files to your web server

## File Structure

```
website/
├── index.html      # Main HTML file
├── styles.css      # CSS styling
├── script.js       # JavaScript for feedback parsing and display
└── README.md       # This file
```

## Feedback Export Format

The app exports feedback in the following format:

```
FEEDBACK REPORT
Generated: [date]
Total Feedback: [number]
Average Rating: [number]/5

Feedback #1
Date: [date]
Rating: ★★★★☆ (4/5)
Email: [email or "Not provided"]
Feedback:
[feedback text]
==================================================
```

The website can parse both this text format and JSON format if you modify the export function in the app.

## Customization

You can customize the website by:

1. **Editing `index.html`**: Modify the setup instructions or add new sections
2. **Editing `styles.css`**: Change colors, fonts, and layout
3. **Editing `script.js`**: Modify feedback parsing logic or add new features

## Browser Support

This website works in all modern browsers:
- Chrome
- Firefox
- Safari
- Edge

## License

Same as the MedicationRunner app.

