document.addEventListener('DOMContentLoaded', function() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
    const menuToggle = document.getElementById('menuToggle');
    const navLinksContainer = document.getElementById('navLinks');
    const btnComenzar = document.getElementById('btnComenzar');
    const btnAbrir = document.getElementById('btnAbrir');
    const sorpresaContent = document.getElementById('sorpresaContent');

    // Cambiar secciones
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const sectionId = this.getAttribute('data-section');
            
            // Si es "sorpresa", ir a ella
            if (sectionId === 'sorpresa') {
                showSection('sorpresa');
            } else {
                showSection(sectionId);
            }

            // Actualizar nav activo
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');

            // Cerrar menú móvil
            navLinksContainer.classList.remove('active');
            menuToggle.textContent = '☰';

            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // Mostrar sección
    function showSection(sectionId) {
        sections.forEach(section => {
            section.classList.remove('active');
        });

        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }
    }

    // Menu toggle móvil
    menuToggle.addEventListener('click', function() {
        navLinksContainer.classList.toggle('active');
        if (navLinksContainer.classList.contains('active')) {
            menuToggle.textContent = '✕';
        } else {
            menuToggle.textContent = '☰';
        }
    });

    // Botón "Quiero verte sorprendida"
    if (btnComenzar) {
        btnComenzar.addEventListener('click', function() {
            showSection('timeline');
            navLinks.forEach(l => l.classList.remove('active'));
            navLinks[1].classList.add('active'); // Timeline
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Botón abrir regalo
    if (btnAbrir) {
        btnAbrir.addEventListener('click', function() {
            sorpresaContent.classList.remove('hidden');
            btnAbrir.style.display = 'none';
            
            // Crear confeti
            createConfetti();
            
            // Efecto de sonido si quieres (opcional)
            playAudio('gift-open');
        });
    }

    // Crear confeti
    function createConfetti() {
        const confettiContainer = document.querySelector('.confeti');
        if (!confettiContainer) return;

        for (let i = 0; i < 50; i++) {
            const confetto = document.createElement('div');
            confetto.style.position = 'fixed';
            confetto.style.width = Math.random() * 10 + 5 + 'px';
            confetto.style.height = confetto.style.width;
            confetto.style.backgroundColor = getRandomColor();
            confetto.style.left = Math.random() * window.innerWidth + 'px';
            confetto.style.top = '-10px';
            confetto.style.borderRadius = '50%';
            confetto.style.zIndex = '9999';
            confetto.style.pointerEvents = 'none';

            document.body.appendChild(confetto);

            let x = Math.random() * 4 - 2;
            let y = Math.random() * 8 + 8;
            let rotation = Math.random() * 360;
            let rotationSpeed = Math.random() * 10 - 5;

            const animate = () => {
                y -= 2;
                x += (Math.random() - 0.5) * 0.5;
                rotation += rotationSpeed;

                confetto.style.transform = `translate(${x}px, -${y}px) rotate(${rotation}deg)`;

                if (y > window.innerHeight + 100) {
                    confetto.remove();
                } else {
                    requestAnimationFrame(animate);
                }
            };

            animate();
        }
    }

    function getRandomColor() {
        const colors = ['#ff1493', '#0052cc', '#ffd700', '#ffb6d9', '#001f3f', '#f8f8f8'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Reproducir audio (opcional)
    function playAudio(type) {
        // Aquí puedes agregar sonidos si quieres
        // Por ahora, solo es un placeholder
    }

    // Animaciones al scroll
    observeElements();

    function observeElements() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        });

        const elements = document.querySelectorAll('.razon-card, .dato-box, .cancion-card');
        elements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'all 0.6s ease-out';
            observer.observe(el);
        });
    }

    // Efecto click en tarjetas
    const cards = document.querySelectorAll('.razon-card, .dato-box, .cancion-card');
    cards.forEach(card => {
        card.addEventListener('click', function() {
            this.style.animation = 'none';
            setTimeout(() => {
                this.style.animation = '';
            }, 10);
        });
    });

    // Inicializar con portada
    showSection('portada');
});

// Soporte para tema oscuro (opcional)
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// Cargar preferencia de tema guardada
if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
}

// Prevenir que la página se abra en pestaña nueva accidentalmente
document.addEventListener('auxclick', (e) => {
    if (e.button === 1) {
        e.preventDefault();
    }
});
