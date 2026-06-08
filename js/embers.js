document.addEventListener("DOMContentLoaded", () => {
    // 1. Create and inject the Glow Container
    if (!document.querySelector('.glow-container')) {
        const glowCont = document.createElement('div');
        glowCont.className = 'glow-container';
        document.body.prepend(glowCont);
    }

    // 2. Create and inject the Ember Container
    let emberCont = document.querySelector('.ember-container');
    if (!emberCont) {
        emberCont = document.createElement('div');
        emberCont.className = 'ember-container';
        document.body.prepend(emberCont);
    }

    // 3. Add Embers (only if they aren't already there)
    if (emberCont.children.length === 0) {
        const colors = ['#ff3344', '#ff6600', '#ff9900'];
        for (let i = 0; i < 30; i++) {
            const ember = document.createElement('div');
            ember.className = 'ember';
            
            ember.style.position = 'absolute';
            ember.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            ember.style.borderRadius = '50%';
            
            const size = Math.random() * 4 + 1;
            ember.style.width = size + 'px';
            ember.style.height = size + 'px';
            ember.style.left = Math.random() * 100 + '%';
            ember.style.bottom = '-10px';
            ember.style.animation = `rise ${Math.random() * 10 + 10}s linear infinite`;
            ember.style.animationDelay = Math.random() * 10 + 's';
            
            emberCont.appendChild(ember);
        }
    }
    
    // 4. Inject keyframes if they don't exist
    if (!document.getElementById('ember-styles')) {
        const style = document.createElement('style');
        style.id = 'ember-styles';
        style.innerHTML = `
            @keyframes rise {
                0% { transform: translateY(0); opacity: 0; }
                50% { opacity: 1; }
                100% { transform: translateY(-100vh); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
});
