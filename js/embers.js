// js/embers.js
console.log("Embers Script: Loading...");

document.addEventListener("DOMContentLoaded", () => {
    console.log("Embers Script: Running!");

    // 1. Create the container
    let emberCont = document.createElement('div');
    emberCont.className = 'ember-container';
    
    // Force CSS via JS to ensure it's visible
    emberCont.style.position = 'fixed';
    emberCont.style.top = '0';
    emberCont.style.left = '0';
    emberCont.style.width = '100%';
    emberCont.style.height = '100%';
    emberCont.style.zIndex = '9999';
    emberCont.style.pointerEvents = 'none'; // So you can still click buttons
    document.body.prepend(emberCont);

    // 2. Add Embers
    const colors = ['#ff3344', '#ff6600', '#ff9900'];
    for (let i = 0; i < 30; i++) {
        const ember = document.createElement('div');
        ember.className = 'ember';
        
        // Inline styles to guarantee they appear even if CSS file is cached/broken
        ember.style.position = 'absolute';
        ember.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        ember.style.borderRadius = '50%';
        
        const size = Math.random() * 4 + 1;
        ember.style.width = size + 'px';
        ember.style.height = size + 'px';
        ember.style.left = Math.random() * 100 + '%';
        ember.style.bottom = '-10px'; // Start below screen
        ember.style.animation = `rise ${Math.random() * 10 + 10}s linear infinite`;
        ember.style.animationDelay = Math.random() * 10 + 's';
        
        emberCont.appendChild(ember);
    }
    
    // Inject a quick keyframe animation if it's missing from your CSS
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes rise {
            0% { transform: translateY(0); opacity: 0; }
            50% { opacity: 1; }
            100% { transform: translateY(-100vh); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    console.log("Embers Script: Finished injecting elements.");
});
