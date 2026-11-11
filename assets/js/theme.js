
const savedTheme = localStorage.getItem("curl-theme");

const theme =
  savedTheme === "light" ? "light" : "dark";

document.documentElement.dataset.theme = theme;
