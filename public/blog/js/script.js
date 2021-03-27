const textarea = document.querySelector("textarea");
const hidden = document.querySelector(".helper");
// textarea.addEventListener("input", () => {
//     hidden.value = textarea.value;
// });

textarea.size = textarea.value.length;

textarea.onchange = function() {
    this.size = this.value.length;
}