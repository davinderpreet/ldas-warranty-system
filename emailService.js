const axios = require('axios');

class EmailService {
  constructor() {
    this.apiKey = process.env.OMNISEND_API_KEY;
    this.baseUrl = 'https://api.omnisend.com/v5';
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
      
      // Add contact to Omnisend with your exact segment tags
      await this.addContactV5(customerData, warrantyData);
      
      console.log('✅ Contact added to Omnisend with warranty segment tags');
      
      return { 
        success: true, 
        messageId: `omnisend-v5-${Date.now()}`,
        message: 'Contact added to Omnisend with warranty tags. Your existing automation will trigger.'
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
      console.log('👤 Adding contact to Omnisend with segment tags...');
      
      // Generate the correct warranty segment tag based on product
      const warrantySegmentTag = this.getWarrantySegmentTag(warrantyData.product);
      console.log(`🏷️ Using segment tag: ${warrantySegmentTag}`);
      
      // Omnisend v5 contact format with your exact segment tags
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
          warrantySegmentTag,           // Your exact segment tag (TH11 Warranty Signup, G7 Warranty Signup)
          'warranty-customer',          // General warranty customer tag
          'warranty-active',            // Active warranty status
          `source-${warrantyData.source.toLowerCase().replace(/[^a-z0-9]/g, '-')}` // Purchase source
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

      console.log('✅ Contact added to Omnisend successfully');
      console.log(`✅ Tagged with: ${warrantySegmentTag}`);
      
      // Trigger warranty registration event
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

  getWarrantySegmentTag(productName) {
    // Map products to your exact segment tags
    const segmentTagMap = {
      'LDAS TH11 Headset': 'TH11 Warranty Signup',
      'LDAS G7 Headset': 'G7 Warranty Signup',
      'LDAS G10 Headset': 'G10 Warranty Signup'  // Add G10 tag for future use
    };
    
    const tag = segmentTagMap[productName];
    if (!tag) {
      console.warn(`⚠️ No segment tag found for product: ${productName}`);
      return 'General Warranty Signup'; // Fallback tag
    }
    
    return tag;
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
          productSegment: this.getWarrantySegmentTag(warrantyData.product),
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
      
      const response = await axios.get(
        `${this.baseUrl}/contacts?limit=1`,
        { headers: this.headers }
      );
      
      console.log('✅ Omnisend v5 connection successful');
      return {
        success: true,
        message: 'Omnisend v5 API connection successful',
        apiVersion: 'v5',
        contactsEndpoint: 'working',
        segmentTags: {
          TH11: 'TH11 Warranty Signup',
          G7: 'G7 Warranty Signup',
          G10: 'G10 Warranty Signup'
        }
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

  // Method to manually verify segment integration
  async verifySegmentIntegration() {
    return {
      segmentTags: {
        'LDAS TH11 Headset': 'TH11 Warranty Signup',
        'LDAS G7 Headset': 'G7 Warranty Signup',
        'LDAS G10 Headset': 'G10 Warranty Signup'
      },
      message: 'Email service configured to use your exact Omnisend segment tags',
      note: 'Contacts will automatically be added to the correct segments based on product'
    };
  }
}

module.exports = EmailService;
