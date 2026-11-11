// Sets the saved or system theme before the page paints, so dark mode never flashes white.
try {
  var choice = localStorage.getItem('fdb-theme')
  var dark = choice === 'dark' || (choice !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
} catch (e) {
  document.documentElement.dataset.theme = 'light'
}
