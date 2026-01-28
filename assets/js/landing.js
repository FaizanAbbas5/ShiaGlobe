/**
 * Landing page - main JavaScript
 * Handles navbar scroll effects and scrolling
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
 
        // Form submission
        document.getElementById('emailForm').addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Currently under development, use the email icon below');
        });