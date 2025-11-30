/**
 * API設定ファイル
 * 環境を自動判定してAPIのベースURLを返します
 */

const API_CONFIG = {
  // 本番環境のURL
  PRODUCTION_URL: 'https://mycms-tycq.onrender.com',
  
  // ローカル開発環境のURL
  DEVELOPMENT_URL: 'http://localhost:4000',
  
  /**
   * 現在の環境に応じたAPIベースURLを取得
   * @returns {string} APIベースURL
   */
  getBaseURL() {
    // ブラウザ環境の場合
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      
      // localhostまたは127.0.0.1の場合はローカル環境
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        console.log('🔧 Development mode: Using local API');
        return this.DEVELOPMENT_URL;
      }
      
      // それ以外は本番環境
      console.log('🚀 Production mode: Using Render API');
      return this.PRODUCTION_URL;
    }
    
    // Node.js環境の場合（サーバーサイド）
    return process.env.API_BASE_URL || this.DEVELOPMENT_URL;
  },
  
  /**
   * 画像URLにプレフィックスを付与
   * @param {string} url - 画像URL
   * @returns {string} 完全なURL
   */
  getImageURL(url) {
    if (!url) return '';
    
    // 既に完全なURLの場合はそのまま返す
    if (url.startsWith('http://') || 
        url.startsWith('https://') || 
        url.startsWith('data:') || 
        url.startsWith('blob:') || 
        url.startsWith('//')) {
      return url;
    }
    
    // /uploads/で始まる場合はAPIベースURLを付与
    if (url.startsWith('/uploads/')) {
      return `${this.getBaseURL()}${url}`;
    }
    
    return url;
  }
};

// CommonJS環境とES Modules環境の両方に対応
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API_CONFIG;
}

// ブラウザ環境ではグローバルに公開
if (typeof window !== 'undefined') {
  window.API_CONFIG = API_CONFIG;
}
