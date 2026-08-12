importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyCy-euC1CaVTejDj_cCQNgzyJ6uIZHJ0jM",
    authDomain: "mathura-quickmart-v2.firebaseapp.com",
    projectId: "mathura-quickmart-v2",
    storageBucket: "mathura-quickmart-v2.firebasestorage.app",
    messagingSenderId: "365937178136",
    appId: "1:365937178136:web:c3096783b0e1a47d0cb56d"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
    self.registration.showNotification(payload.notification.title, {
        body: payload.notification.body,
        icon: "/images/logo.png"
    });
});
