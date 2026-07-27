let notesButtons = document.getElementsByClassName("notes-button");
let iframeButtons = document.getElementsByClassName("iframe-button");


function getNotes(e) {
    const button = e.currentTarget;
    const container = button.closest(".game-container");
    const notes = container.querySelector(".notes-section");
    notes.classList.toggle("note-active-false");
    container.scrollIntoView({behavior: "smooth"});
}

function getIframe(e) {
    const button = e.currentTarget;
    const container = button.closest(".game-container");
    const iframeSection = container.querySelector(".iframe-section");
    const iFrame = iframeSection.querySelector(".lichess-embed");
    iFrame.src = iFrame.dataset.src;
    iframeSection.classList.toggle("iframe-active-false");
    container.scrollIntoView({behavior: "smooth"});
}

for (var i = 0; i < notesButtons.length; i++) {
    notesButtons[i].addEventListener('click', getNotes);
}

for (var i = 0; i < iframeButtons.length; i++) {
    iframeButtons[i].addEventListener('click', getIframe);
}