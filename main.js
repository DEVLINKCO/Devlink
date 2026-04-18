/* DevLink – shared UI: theme toggle, mobile menu, scroll reveal, FAQ, nav scroll */
(function () {
  var MOON = '<path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>';
  var SUN  = '<path d="M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7zm0-5a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1zm0 17a1 1 0 0 1 1 1v1a1 1 0 0 1-2 0v-1a1 1 0 0 1 1-1zm9-9h1a1 1 0 0 1 0 2h-1a1 1 0 0 1 0-2zM3 11H2a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm14.66-6.07.71-.71a1 1 0 0 1 1.41 1.41l-.71.71a1 1 0 0 1-1.41-1.41zM5.64 18.36l-.71.71a1 1 0 0 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 1.41zm12.02.71-.71-.71a1 1 0 0 1 1.41-1.41l.71.71a1 1 0 0 1-1.41 1.41zM5.64 5.64l-.71-.71A1 1 0 0 1 6.34 3.52l.71.71A1 1 0 0 1 5.64 5.64z"/>';

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var lbl = document.getElementById('themeLabel');
    var ico = document.getElementById('themeIcon');
    if (lbl) lbl.textContent = t === 'light' ? 'Dark' : 'Light';
    if (ico) ico.innerHTML = t === 'light' ? SUN : MOON;
    var logoSrc = t === 'light' ? '/DevLinkRBBX-Black.png' : '/DevLinkRBBX.png';
    var logos = document.querySelectorAll('.nav-logo img, .footer-logo img');
    for (var i = 0; i < logos.length; i++) { logos[i].src = logoSrc; }
    try { localStorage.setItem('devlink-theme', t); } catch (e) {}
  }

  var _prevOnLoad = window.onload;
  window.onload = function () {
    if (_prevOnLoad) { _prevOnLoad(); }

    /* ── Restore saved theme ── */
    var saved = 'dark';
    try { saved = localStorage.getItem('devlink-theme') || 'dark'; } catch (e) {}
    applyTheme(saved);

    /* ── Theme toggle button ── */
    var btn = document.getElementById('themeToggle');
    if (btn) {
      btn.addEventListener('click', function () {
        applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      });
    }

    /* ── Mobile hamburger menu ── */
    var burger  = document.getElementById('navBurger');
    var menu    = document.getElementById('mobileMenu');
    var closeEl = document.getElementById('mobileClose');
    if (burger && menu && closeEl) {
      var links = menu.querySelectorAll('.mobile-nav-link');
      function openMenu()  { menu.classList.add('open');    document.body.style.overflow = 'hidden'; }
      function closeMenu() { menu.classList.remove('open'); document.body.style.overflow = ''; }
      burger.addEventListener('click', openMenu);
      closeEl.addEventListener('click', closeMenu);
      for (var i = 0; i < links.length; i++) {
        links[i].addEventListener('click', closeMenu);
      }
    }

    /* ── Nav pill shrink on scroll ── */
    var navEl = document.querySelector('nav');
    if (navEl) {
      window.addEventListener('scroll', function () {
        if (window.pageYOffset > 60) {
          navEl.classList.add('scrolled');
        } else {
          navEl.classList.remove('scrolled');
        }
      });
    }

    /* ── FAQ accordion (scrollHeight-based) ── */
    var faqBtns = document.querySelectorAll('.faq-question');
    for (var j = 0; j < faqBtns.length; j++) {
      faqBtns[j].addEventListener('click', function () {
        var item = this.parentNode;
        var answer = item.querySelector('.faq-answer');
        var isOpen = item.className.indexOf('open') !== -1;
        var allItems = document.querySelectorAll('.faq-item');
        for (var k = 0; k < allItems.length; k++) {
          allItems[k].classList.remove('open');
          var ans = allItems[k].querySelector('.faq-answer');
          if (ans) { ans.style.maxHeight = null; }
        }
        if (!isOpen && answer) {
          item.classList.add('open');
          answer.style.maxHeight = answer.scrollHeight + 'px';
        }
      });
    }

    /* ── Scroll reveal via IntersectionObserver ── */
    if ('IntersectionObserver' in window) {
      var reveals = document.querySelectorAll('.reveal');
      var revealObserver = new IntersectionObserver(function (entries) {
        for (var r = 0; r < entries.length; r++) {
          if (entries[r].isIntersecting) {
            entries[r].target.classList.add('visible');
            revealObserver.unobserve(entries[r].target);
          }
        }
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

      for (var rv = 0; rv < reveals.length; rv++) {
        revealObserver.observe(reveals[rv]);
      }
    } else {
      /* Fallback: show everything immediately */
      var revealsFallback = document.querySelectorAll('.reveal');
      for (var rf = 0; rf < revealsFallback.length; rf++) {
        revealsFallback[rf].classList.add('visible');
      }
    }

    /* ── Hero word-cycling animation ── */
    var words = ["Roblox.", "Developers.", "Studios.", "Builders.", "Creators.", "You."];
    var wordIdx = 0;
    var wordEl = document.getElementById("word");
    if (wordEl) {
      wordEl.textContent = words[0];
      wordEl.style.transition = "transform 0.35s ease, opacity 0.35s";
      wordEl.style.transform = "translateY(0)";
      wordEl.style.opacity = "1";
      setInterval(function () {
        wordEl.style.transition = "transform 0.35s ease, opacity 0.35s";
        wordEl.style.transform = "translateY(-120%)";
        wordEl.style.opacity = "0";
        setTimeout(function () {
          wordIdx = (wordIdx + 1) % words.length;
          wordEl.textContent = words[wordIdx];
          wordEl.style.transition = "none";
          wordEl.style.transform = "translateY(120%)";
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              wordEl.style.transition = "transform 0.35s ease, opacity 0.35s";
              wordEl.style.transform = "translateY(0)";
              wordEl.style.opacity = "1";
            });
          });
        }, 360);
      }, 2000);
    }

    /* ── Trust block word-cycling animation ── */
    var trustWords = ["No ghosting.", "No scams.", "No stress."];
    var trustIdx = 0;
    var trustEl = document.getElementById("trustWord");
    if (trustEl) {
      trustEl.textContent = trustWords[0];
      trustEl.style.transition = "transform 0.35s ease, opacity 0.35s";
      trustEl.style.transform = "translateY(0)";
      trustEl.style.opacity = "1";
      setInterval(function () {
        trustEl.style.transition = "transform 0.35s ease, opacity 0.35s";
        trustEl.style.transform = "translateY(-120%)";
        trustEl.style.opacity = "0";
        setTimeout(function () {
          trustIdx = (trustIdx + 1) % trustWords.length;
          trustEl.textContent = trustWords[trustIdx];
          trustEl.style.transition = "none";
          trustEl.style.transform = "translateY(120%)";
          requestAnimationFrame(function () {
            requestAnimationFrame(function () {
              trustEl.style.transition = "transform 0.35s ease, opacity 0.35s";
              trustEl.style.transform = "translateY(0)";
              trustEl.style.opacity = "1";
            });
          });
        }, 360);
      }, 2000);
    }

    /* ── Hero grid cursor reveal ── */
    var heroSection = document.querySelector('.hero');
    var gridCursor = document.getElementById('heroGridCursor');
    if (heroSection && gridCursor) {
      heroSection.addEventListener('mousemove', function (e) {
        var rect = heroSection.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var mask = 'radial-gradient(circle 220px at ' + x + 'px ' + y + 'px, black 0%, transparent 100%)';
        gridCursor.style.webkitMaskImage = mask;
        gridCursor.style.maskImage = mask;
      });
      heroSection.addEventListener('mouseleave', function () {
        gridCursor.style.webkitMaskImage = 'radial-gradient(circle 220px at -999px -999px, black 0%, transparent 100%)';
        gridCursor.style.maskImage = 'radial-gradient(circle 220px at -999px -999px, black 0%, transparent 100%)';
      });
    }

    /* ── Legal tab switching ── */
    var legalTabs = document.querySelectorAll('.legal-tab');
    if (legalTabs.length) {
      for (var lt = 0; lt < legalTabs.length; lt++) {
        legalTabs[lt].addEventListener('click', function () {
          var target = this.getAttribute('data-tab');
          for (var lj = 0; lj < legalTabs.length; lj++) {
            legalTabs[lj].classList.remove('active');
          }
          var sections = document.querySelectorAll('.legal-section');
          for (var ls = 0; ls < sections.length; ls++) {
            sections[ls].classList.remove('active');
          }
          this.classList.add('active');
          var targetSection = document.getElementById('tab-' + target);
          if (targetSection) { targetSection.classList.add('active'); }
        });
      }
    }

  };
})();
