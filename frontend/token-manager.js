// Token-Verwaltung für CodexMiroir
class TokenManager {
    constructor() {
        this.storageKey = 'codex-miroir-token';
        this.token = this.getOrCreateToken();
    }
    
    // Generiert einen sicheren Token
    generateSecureToken() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 16; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
    }
    
    // Lädt Token aus localStorage oder erstellt einen neuen
    getOrCreateToken() {
        let token = localStorage.getItem(this.storageKey);
        
        if (!token || token.length < 8) {
            token = this.generateSecureToken();
            localStorage.setItem(this.storageKey, token);
            console.log('Neuer sicherer Token generiert:', token);
        }
        
        return token;
    }
    
    // Gibt den aktuellen Token zurück
    getToken() {
        return this.token;
    }
    
    // Erstellt einen neuen Token (für Reset)
    resetToken() {
        const newToken = this.generateSecureToken();
        localStorage.setItem(this.storageKey, newToken);
        this.token = newToken;
        console.log('Token zurückgesetzt:', newToken);
        return newToken;
    }
}

// Globale Token-Manager-Instanz
window.tokenManager = new TokenManager();