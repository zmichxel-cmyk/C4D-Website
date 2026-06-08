document.addEventListener("DOMContentLoaded", () => {
    // Prevent duplicates if already in HTML
    if (document.querySelector('.ember-container')) return;

    const emberCont = document.createElement('div');
    emberCont.className = 'ember-container';
    const glowCont = document.createElement('div');
    glowCont.className = 'glow-container';

    document.body.prepend(glowCont);
    document.body.prepend(emberCont);

    // Ember Logic
    const colors = ['#ff3344', '#ff6600', '#ff9900']; 
    for (let i = 0; i < 30; i++) {
        const ember = document.createElement('div');
        ember.className = 'ember';
        ember.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        const size = Math.random() * 4 + 1;
        ember.style.width = size + 'px';
        ember.style.height = size + 'px';
        ember.style.left = Math.random() * 100 + '%';
        ember.style.animationDuration = (Math.random() * 10 + 10) + 's';
        ember.style.animationDelay = Math.random() * 10 + 's';
        emberCont.appendChild(ember);
    }
});
