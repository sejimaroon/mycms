/**
 * Admin用API設定
 */

const API_CONFIG = {
  PRODUCTION_URL: 'https://mycms-tycq.onrender.com',
  DEVELOPMENT_URL: 'http://localhost:4000',
  
  getBaseURL() {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return this.DEVELOPMENT_URL;
    }
    
    return this.PRODUCTION_URL;
  },
  
  getImageURL(url) {
    if (!url) return '';
    
    if (url.startsWith('http://') || 
        url.startsWith('https://') || 
        url.startsWith('data:') || 
        url.startsWith('blob:') || 
        url.startsWith('//')) {
      return url;
    }
    
    if (url.startsWith('/uploads/')) {
      return `${this.getBaseURL()}${url}`;
    }
    
    return url;
  }
};

export default API_CONFIG;
