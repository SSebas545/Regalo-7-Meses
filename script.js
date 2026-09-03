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
        for (let i = 0; i < 60; i++) {
            const confetto = document.createElement('div');
            confetto.style.position = 'fixed';
            confetto.style.width = Math.random() * 10 + 5 + 'px';
            confetto.style.height = Math.random() * 5 + 5 + 'px';
            confetto.style.backgroundColor = getRandomColor();
            confetto.style.zIndex = '9999';
            confetto.style.pointerEvents = 'none';
            confetto.style.borderRadius = '2px';

            document.body.appendChild(confetto);

            let posX = Math.random() * window.innerWidth;
            let posY = -20;
            let xSpeed = (Math.random() - 0.5) * 4;
            let ySpeed = Math.random() * 3 + 2;
            let rotation = Math.random() * 360;
            let rotationSpeed = Math.random() * 10 - 5;

            const animate = () => {
                posY += ySpeed;
                posX += xSpeed;
                rotation += rotationSpeed;

                confetto.style.top = posY + 'px';
                confetto.style.left = posX + 'px';
                confetto.style.transform = `rotate(${rotation}deg)`;

                if (posY < window.innerHeight) {
                    requestAnimationFrame(animate);
                } else {
                    confetto.remove();
                }
            };

            requestAnimationFrame(animate);
        }
    }
    function getRandomColor() {
        const colors = ['#ff1493', '#0052cc', '#ffd700', '#ffb6d9', '#001f3f', '#f8f8f8'];
        return colors[Math.floor(Math.random() * colors.length)];
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
    // --- Botones de "Siguiente" al final de cada página ---
    const btnSiguientes = document.querySelectorAll('.btn-siguiente');
    
    btnSiguientes.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            
            // Cambiar a la sección objetivo
            showSection(targetId);
            
            // Actualizar el estado "activo" en el menú de navegación superior
            navLinks.forEach(l => l.classList.remove('active'));
            const correspondingLink = document.querySelector(`.nav-link[data-section="${targetId}"]`);
            if (correspondingLink) {
                correspondingLink.classList.add('active');
            }
            
            // Subir suavemente al inicio de la página
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

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

