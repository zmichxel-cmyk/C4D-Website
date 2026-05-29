document.addEventListener("DOMContentLoaded", () => {
    console.log("Embers script loaded!"); // Check your browser console for this!
    
    const container = document.createElement('div');
    container.className = 'ember-container';
    document.body.appendChild(container); // Changed from prepend to appendChild

    for (let i = 0; i < 30; i++) {
        const ember = document.createElement('div');
        ember.className = 'ember';
        ember.style.left = Math.random() * 100 + '%';
        ember.style.top = Math.random() * 100 + '%'; // Added top position
        ember.style.animationDelay = Math.random() * 8 + 's';
        container.appendChild(ember);
    }
});
