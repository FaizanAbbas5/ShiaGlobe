/**
 * Landing page - main JavaScript
 * Handles the navbar scroll effect, the contact form and the "Our Vision" tabs
 */

// Navbar scroll effect
        window.addEventListener('scroll', () => {
            const navbar = document.getElementById('navbar');
            if (window.scrollY > 100) {
                navbar.classList.remove('transparent');
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
                navbar.classList.add('transparent');
            }
        });
 
        // Form submission: opens the visitor's email app with the message written out, addressed to the site
        const emailForm = document.getElementById('emailForm');
        emailForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const { name, email, message } = emailForm.elements;
            const subject = `Tārīkh al-Shi'a: message from ${name.value.trim()}`;
            const body = `${message.value.trim()}\n\n${name.value.trim()}\n${email.value.trim()}`;
            window.location.href = `mailto:${emailForm.dataset.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        });

        // Our Vision: the tabs switch the map layer (each layer draws itself when shown). Until someone picks a tab,
        // they move on by themselves while the window is on screen; not at all with reduced motion.
        (() => {
            const win = document.querySelector('.vision-window');
            if (!win) return;
            const tabs = [...win.querySelectorAll('[role="tab"]')];
            const panel = win.querySelector('[role="tabpanel"]');
            const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
            let current = 0, timer = null, chosen = false;

            function show(i) {
                current = i;
                const id = tabs[i].dataset.layer;
                tabs.forEach((t, k) => {
                    t.setAttribute('aria-selected', k === i);
                    t.tabIndex = k === i ? 0 : -1;
                });
                panel.setAttribute('aria-labelledby', tabs[i].id);
                win.querySelector('.vw-crumb').textContent = tabs[i].querySelector('.vt-title').textContent;
                win.querySelectorAll('.vw-rail-icon[data-layer]').forEach(r => r.classList.toggle('on', r.dataset.layer === id));
                win.querySelectorAll('.vw-caption').forEach(c => { c.hidden = c.dataset.layer !== id; });
                // take every layer off, then put the chosen one back on the next frame, so its drawing starts again
                win.querySelectorAll('.vw-layer').forEach(l => l.classList.remove('on'));
                requestAnimationFrame(() => win.querySelector(`.vw-layer[data-layer="${id}"]`).classList.add('on'));
            }

            function stopCycling() {
                chosen = true;
                clearInterval(timer);
            }

            tabs.forEach((t, i) => t.addEventListener('click', () => { stopCycling(); show(i); }));
            win.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
                const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
                if (!step) return;
                e.preventDefault();
                stopCycling();
                show((current + step + tabs.length) % tabs.length);
                tabs[current].focus();
            });

            if (reduce || !('IntersectionObserver' in window)) return;
            new IntersectionObserver(([entry]) => {
                clearInterval(timer);
                if (!entry.isIntersecting || chosen) return;
                show(current);
                timer = setInterval(() => show((current + 1) % tabs.length), 8000);
            }, { threshold: 0.4 }).observe(win);
        })();