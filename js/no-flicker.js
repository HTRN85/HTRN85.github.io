// Prevent page flickering and auto-refresh
(function() {
    console.log('No-flicker script loaded');
    
    // Disable any setInterval calls that might cause flickering
    const originalSetInterval = window.setInterval;
    window.setInterval = function(callback, delay) {
        // Only allow intervals longer than 5 seconds
        if (delay < 5000) {
            console.log('Blocked auto-refresh interval:', delay, 'ms');
            return null;
        }
        return originalSetInterval(callback, delay);
    };
    
    // Disable page reloads
    const originalReload = window.location.reload;
    window.location.reload = function() {
        console.log('Blocked page reload attempt');
    };
    
    console.log('Auto-refresh protection enabled');
})();