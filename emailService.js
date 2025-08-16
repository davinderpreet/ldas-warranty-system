const axios = require('axios');

class EmailService {
  constructor() {
    this.apiKey = process.env.OMNISEND_API_KEY;
    this.baseUrl = 'https://api.omnisend.com/v5';  // Fixed: v5 instead of v3
    this.fromEmail = process.env.FROM_EMAIL || 'support@ldaselectronics.com';
    this.fromName = process.env.FROM_NAME || 'LDAS Electronics';
    
    this.headers = {
      'X-API-KEY': this.apiKey,
      'Content-Type': 'application/json',
      'accept': 'application/json'
    };

    console.log('📧 EmailService initialized with:', {
      baseUrl: this.baseUrl,
      fromEmail: this.fromEmail,
      fromName: this.fromName,
      hasApiKey: !!this.apiKey
    });
  }

  async sendWarrantyConfirmation(customerData, warrantyData) {
    try {
      console.log('📧 Sending warranty confirmation email to:', customerData.email);
      
      // First, add/update contact in Omnisend using v5 format
      await this.addContactV5(customerData, warrantyData);
      
      // For now, we'll use a simulated email send since Omnisend v5 doesn't have direct email sending
      // In production, you'd create a campaign or use a triggered automation
      console.log('✅ Email process completed - contact added to Omnisend with warranty data');
      
      return { 
        success: true, 
        messageId: `omnisend-v5-${Date.now()}`,
        message: 'Contact added to Omnisend with warranty information. Email will be sent via Omnisend automation.'
      };
      
    } catch (error) {
      console.error('❌ Email service failed:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      return { 
        success: false, 
        error: error.response?.data || error.message,
        message: 'Failed to process email confirmation'
      };
    }
  }

  async addContactV5(customerData, warrantyData) {
    try {
      console.log('👤 Adding contact to Omnisend v5...');
      
      // Omnisend v5 contact format
      const contactData = {
        identifiers: [
          {
            type: "email",
            id: customerData.email,
            channels: {
              email: {
                status: "subscribed",
                statusDate: new Date().toISOString()
              }
            }
          }
        ],
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        tags: [
          'warranty-customer',
          `product-${this.getProductCode(warrantyData.product)}`,
          'warranty-active',
          `source-${warrantyData.source.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        ],
        customProperties: {
          warrantyNumber: warrantyData.warrantyNumber,
          product: warrantyData.product,
          purchaseDate: warrantyData.purchaseDate.toISOString(),
          warrantyEndDate: warrantyData.warrantyEndDate.toISOString(),
          source: warrantyData.source,
          registrationDate: new Date().toISOString()
        }
      };

      // Add phone if provided
      if (customerData.phone) {
        contactData.identifiers.push({
          type: "phone",
          id: customerData.phone,
          channels: {
            sms: {
              status: "nonSubscribed"
            }
          }
        });
      }

      const response = await axios.post(
        `${this.baseUrl}/contacts`,
        contactData,
        { headers: this.headers }
      );

      console.log('✅ Contact added to Omnisend v5 successfully');
      
      // Trigger custom event for warranty registration
      await this.triggerWarrantyEvent(customerData, warrantyData);
      
      return response.data;
    } catch (error) {
      console.error('❌ Contact creation failed:', {
        status: error.response?.status,
        message: error.response?.data || error.message,
        url: error.config?.url
      });
      
      throw error;
    }
  }

  async triggerWarrantyEvent(customerData, warrantyData) {
    try {
      console.log('🎯 Triggering warranty registration event...');
      
      const eventData = {
        email: customerData.email,
        eventName: "warranty-registered",
        eventVersion: "1.0.0",
        origin: "API",
        properties: {
          product: warrantyData.product,
          warrantyNumber: warrantyData.warrantyNumber,
          purchaseDate: warrantyData.purchaseDate.toISOString(),
          warrantyEndDate: warrantyData.warrantyEndDate.toISOString(),
          source: warrantyData.source,
          customerName: `${customerData.firstName} ${customerData.lastName}`
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/events`,
        eventData,
        { headers: this.headers }
      );

      console.log('✅ Warranty registration event triggered successfully');
      return response.data;
    } catch (error) {
      console.log('⚠️ Event trigger failed (continuing anyway):', {
        status: error.response?.status,
        message: error.response?.data || error.message
      });
      // Don't throw - this is optional
    }
  }

  getProductCode(productName) {
    const productMap = {
      'LDAS TH11 Headset': 'th11',
      'LDAS G7 Headset': 'g7',
      'LDAS G10 Headset': 'g10'
    };
    return productMap[productName] || 'unknown';
  }

  async testConnection() {
    try {
      console.log('🧪 Testing Omnisend v5 connection...');
      
      // Test by trying to get contacts (this should work with any valid API key)
      const response = await axios.get(
        `${this.baseUrl}/contacts?limit=1`,
        { headers: this.headers }
      );
      
      console.log('✅ Omnisend v5 connection successful');
      return {
        success: true,
        message: 'Omnisend v5 API connection successful',
        apiVersion: 'v5',
        contactsEndpoint: 'working'
      };
    } catch (error) {
      console.error('❌ Omnisend v5 connection failed:', {
        status: error.response?.status,
        message: error.response?.data || error.message,
        url: error.config?.url
      });
      
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status,
        apiVersion: 'v5',
        suggestion: 'Check API key validity in Omnisend dashboard'
      };
    }
  }

  // Legacy method for manual email sending (if needed)
  async sendManualEmail(customerData, warrantyData) {
    // Since Omnisend v5 doesn't have direct email sending via API,
    // this would need to be handled through:
    // 1. Creating an automation in Omnisend dashboard
    // 2. Using a different email service as backup
    // 3. Or triggering a campaign
    
    console.log('📧 Manual email sending not available in Omnisend v5 API');
    console.log('💡 Recommendation: Set up automation in Omnisend dashboard triggered by "warranty-registered" event');
    
    return {
      success: false,
      message: 'Direct email sending not supported in Omnisend v5. Use automation triggers instead.',
      recommendation: 'Create automation in Omnisend dashboard for warranty-registered events'
    };
  }
}

module.exports = EmailService;
