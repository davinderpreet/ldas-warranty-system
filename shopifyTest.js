// Simple Shopify Connection Test
const axios = require('axios');

class ShopifyTester {
  constructor() {
    this.shopName = process.env.SHOPIFY_SHOP_NAME;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    this.apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';
    this.baseUrl = `https://${this.shopName}.myshopify.com/admin/api/${this.apiVersion}`;
    
    this.headers = {
      'X-Shopify-Access-Token': this.accessToken,
      'Content-Type': 'application/json'
    };
  }

  async testConnection() {
    try {
      console.log('🧪 Testing Shopify connection...');
      console.log(`Store: ${this.shopName}.myshopify.com`);
      
      const response = await axios.get(
        `${this.baseUrl}/shop.json`,
        { headers: this.headers }
      );

      console.log('✅ SUCCESS! Shopify connection working!');
      return {
        success: true,
        shop: {
          name: response.data.shop.name,
          domain: response.data.shop.domain,
          email: response.data.shop.email,
          currency: response.data.shop.currency
        }
      };
    } catch (error) {
      console.error('❌ FAILED! Shopify connection error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }
}

module.exports = ShopifyTester;
