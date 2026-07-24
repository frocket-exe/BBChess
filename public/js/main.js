let notesButtons = document.getElementsByClassName("notes-button");

function getNotes(e) {
    const button = e.currentTarget;
    const container = button.closest(".game-container");
    const notes = container.querySelector(".notes-section");
    notes.classList.toggle("note-active-false");
    notes.scrollIntoView({behavior: "smooth"});
}

// for (var i = 0; i < notesButtons.length; i++) {
//     notesButtons[i].addEventListener('click', event => {alert("Hello World!");});
// }

for (var i = 0; i < notesButtons.length; i++) {
    notesButtons[i].addEventListener('click', getNotes);
}