window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const imgSrc = urlParams.get('img');
    const mainImage = document.getElementById('main-image');

    if (imgSrc) {
        mainImage.src = `images/${imgSrc}`;
    } else {
        mainImage.alt = 'Image not found';
    }
}
