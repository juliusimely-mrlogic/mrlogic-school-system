document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = '/index.html'; // Mpeleke kwenye dashibodi
        } else {
            errorMsg.innerText = data.error || "Kuingia kimeshindikana";
        }
    } catch (error) {
        console.error("Login Error:", error);
        errorMsg.innerText = "Kuna tatizo la mtandao. Jaribu tena.";
    }
});