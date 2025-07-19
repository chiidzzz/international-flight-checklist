document
  .querySelectorAll('input[type="checkbox"]')
  .forEach((checkbox, index) => {
    // Restore saved state from localStorage
    const saved = localStorage.getItem("checkbox_" + index);
    if (saved === "true") {
      checkbox.checked = true;
      checkbox.closest(".item").classList.add("dimmed");
    }

    // Save state on change
    checkbox.addEventListener("change", function () {
      this.closest(".item").classList.toggle("dimmed", this.checked);
      localStorage.setItem("checkbox_" + index, this.checked);
    });
  });

// Optional: Clear all checkboxes and localStorage on demand
function clearChecklist() {
  document
    .querySelectorAll('input[type="checkbox"]')
    .forEach((checkbox, index) => {
      checkbox.checked = false;
      checkbox.closest(".item").classList.remove("dimmed");
      localStorage.removeItem("checkbox_" + index);
    });
}
