(function () {
  var button = document.getElementById('home-explore');
  var target = document.getElementById('home-study');
  if (!button || !target) return;
  button.addEventListener('click', function () {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  });
})();
