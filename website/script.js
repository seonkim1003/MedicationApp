let feedbackData = [];

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    
    // Add active class to clicked tab
    event.target.classList.add('active');
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            parseFeedbackData(text);
        } catch (error) {
            alert('Error reading file: ' + error.message);
        }
    };
    reader.readAsText(file);
}

function parseFeedbackData(text) {
    try {
        // Try to parse as JSON first (if exported as JSON)
        let feedbacks = [];
        
        // Check if it's a JSON array
        if (text.trim().startsWith('[')) {
            feedbacks = JSON.parse(text);
        } else {
            // Parse the text format from the app's export
            feedbacks = parseTextFormat(text);
        }
        
        if (Array.isArray(feedbacks) && feedbacks.length > 0) {
            feedbackData = feedbacks;
            displayFeedback();
            updateStats();
        } else {
            alert('No valid feedback data found in the file.');
        }
    } catch (error) {
        // Try parsing as text format
        try {
            feedbackData = parseTextFormat(text);
            if (feedbackData.length > 0) {
                displayFeedback();
                updateStats();
            } else {
                alert('Could not parse feedback data. Please check the file format.');
            }
        } catch (parseError) {
            alert('Error parsing feedback data: ' + parseError.message);
        }
    }
}

function parseTextFormat(text) {
    const feedbacks = [];
    
    // Split by the separator (50 equal signs)
    const separator = '='.repeat(50);
    const sections = text.split(separator);
    
    sections.forEach((section, index) => {
        if (!section.trim()) return;
        
        const lines = section.trim().split('\n');
        const feedback = {
            id: Date.now().toString() + index + Math.random().toString(36).substr(2, 9),
            timestamp: '',
            rating: 0,
            email: '',
            feedback: ''
        };
        
        let inFeedbackSection = false;
        let feedbackLines = [];
        
        lines.forEach((line, lineIndex) => {
            const trimmedLine = line.trim();
            
            // Skip header lines
            if (trimmedLine.startsWith('FEEDBACK REPORT') || 
                trimmedLine.startsWith('Generated:') || 
                trimmedLine.startsWith('Total Feedback:') || 
                trimmedLine.startsWith('Average Rating:') ||
                trimmedLine === '') {
                return;
            }
            
            // Parse Feedback # line
            if (trimmedLine.startsWith('Feedback #')) {
                // Skip, just indicates start of new feedback
                return;
            }
            
            // Parse Date
            if (trimmedLine.startsWith('Date: ')) {
                const dateStr = trimmedLine.replace('Date: ', '').trim();
                try {
                    // Try to parse the date
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                        feedback.timestamp = date.toISOString();
                    }
                } catch (e) {
                    console.warn('Could not parse date:', dateStr);
                }
                return;
            }
            
            // Parse Rating (format: "Rating: ★★★★☆ (4/5)")
            if (trimmedLine.startsWith('Rating: ')) {
                const ratingMatch = trimmedLine.match(/\((\d)\/5\)/);
                if (ratingMatch) {
                    feedback.rating = parseInt(ratingMatch[1], 10);
                }
                return;
            }
            
            // Parse Email
            if (trimmedLine.startsWith('Email: ')) {
                const email = trimmedLine.replace('Email: ', '').trim();
                if (email && email !== 'Not provided' && email !== '') {
                    feedback.email = email;
                }
                return;
            }
            
            // Parse Feedback text (comes after "Feedback:" line)
            if (trimmedLine === 'Feedback:') {
                inFeedbackSection = true;
                return;
            }
            
            // Collect feedback text lines
            if (inFeedbackSection && trimmedLine) {
                feedbackLines.push(trimmedLine);
            }
        });
        
        // Join feedback lines
        feedback.feedback = feedbackLines.join('\n').trim();
        
        // Only add if we have valid feedback data
        if (feedback.feedback && feedback.rating > 0) {
            // Set default timestamp if not set
            if (!feedback.timestamp) {
                feedback.timestamp = new Date().toISOString();
            }
            feedbacks.push(feedback);
        }
    });
    
    return feedbacks;
}

function displayFeedback() {
    const feedbackList = document.getElementById('feedbackList');
    
    if (feedbackData.length === 0) {
        feedbackList.innerHTML = `
            <div class="empty-state">
                <p>📤 No feedback data loaded.</p>
                <p>Export feedback from the app and upload it here to view.</p>
            </div>
        `;
        return;
    }
    
    // Sort by timestamp (newest first)
    const sortedFeedback = [...feedbackData].sort((a, b) => {
        const dateA = new Date(a.timestamp || 0);
        const dateB = new Date(b.timestamp || 0);
        return dateB - dateA;
    });
    
    feedbackList.innerHTML = sortedFeedback.map(feedback => {
        const date = feedback.timestamp ? new Date(feedback.timestamp).toLocaleString() : 'Unknown date';
        const stars = renderStars(feedback.rating || 0);
        const email = feedback.email ? `<div class="feedback-email">Email: ${feedback.email}</div>` : '';
        
        return `
            <div class="feedback-item">
                <div class="feedback-header">
                    <div>
                        <div class="feedback-date">${date}</div>
                        <div class="feedback-rating">${stars}</div>
                    </div>
                </div>
                ${email}
                <div class="feedback-text">${escapeHtml(feedback.feedback || 'No feedback text provided.')}</div>
            </div>
        `;
    }).join('');
}

function renderStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<span class="star filled">★</span>';
        } else {
            stars += '<span class="star">☆</span>';
        }
    }
    return stars;
}

function updateStats() {
    if (feedbackData.length === 0) {
        document.getElementById('statsSection').style.display = 'none';
        return;
    }
    
    document.getElementById('statsSection').style.display = 'block';
    
    const total = feedbackData.length;
    const sum = feedbackData.reduce((acc, f) => acc + (f.rating || 0), 0);
    const average = total > 0 ? (sum / total).toFixed(1) : 0;
    
    document.getElementById('totalFeedback').textContent = total;
    document.getElementById('averageRating').textContent = average;
    
    // Calculate ratings breakdown
    const ratings = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    feedbackData.forEach(f => {
        const rating = f.rating || 0;
        if (rating >= 1 && rating <= 5) {
            ratings[rating]++;
        }
    });
    
    const breakdownHtml = `
        <h4>Ratings Breakdown:</h4>
        ${[5, 4, 3, 2, 1].map(rating => `
            <div class="rating-row">
                <span class="rating-label">${rating} ${rating === 1 ? 'star' : 'stars'}:</span>
                <span class="rating-count">${ratings[rating]}</span>
            </div>
        `).join('')}
    `;
    
    document.getElementById('ratingsBreakdown').innerHTML = breakdownHtml;
}

function clearFeedback() {
    feedbackData = [];
    displayFeedback();
    document.getElementById('statsSection').style.display = 'none';
    document.getElementById('feedbackFileInput').value = '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Allow drag and drop for feedback file
document.addEventListener('DOMContentLoaded', function() {
    const feedbackSection = document.getElementById('feedback');
    const fileInput = document.getElementById('feedbackFileInput');
    
    feedbackSection.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        feedbackSection.style.backgroundColor = '#f0f0f0';
    });
    
    feedbackSection.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        feedbackSection.style.backgroundColor = '';
    });
    
    feedbackSection.addEventListener('drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        feedbackSection.style.backgroundColor = '';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.json')) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    parseFeedbackData(event.target.result);
                };
                reader.readAsText(file);
            } else {
                alert('Please upload a text file (.txt) or JSON file (.json)');
            }
        }
    });
});

