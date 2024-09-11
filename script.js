document.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
  checkbox.addEventListener("change", function () {
    // Toggle the "dimmed" class on the grandparent div ('.item')
    this.closest(".item").classList.toggle("dimmed", this.checked);
  });
});
