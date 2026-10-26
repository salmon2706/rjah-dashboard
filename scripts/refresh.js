(function () {
    var link = document.querySelector('link[href*="tv.css"]');
    var match = link && link.getAttribute('href').match(/[?&]v=(\d+)/);
    if (!match) return;
    var token = match[1];

    setInterval(function () {
        fetch('index.html?t=' + Date.now(), { cache: 'no-store' })
            .then(function (res) { return res.text(); })
            .then(function (html) {
                if (html.indexOf('v=' + token) === -1) location.reload();
            })
            .catch(function () {});
    }, 10 * 60 * 1000);
})();
