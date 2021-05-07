const ham = document.getElementsByClassName("ham");
ham[0].addEventListener("click", function() {
  this.classList.toggle("active");
  let answer = this.nextElementSibling;
    if (answer.style.maxHeight) {
      answer.style.maxHeight = null;
    } else {
      answer.style.maxHeight = answer.scrollHeight + "px";
    }
})