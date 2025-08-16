const axios = require('axios');

class EmailService {
  constructor() {
    this.apiKey = process.env.OMNISEND_API_KEY;
    this.baseUrl = 'https://api.omnisend.com/v3';
    this.fromEmail = process.env.FROM_EMAIL || 'support@ldaselectronics.com';
    this.fromName = process.env.FROM_NAME || 'LDAS Electronics';
    
    this.headers = {
      'X-API-KEY': this.apiKey,
      'Content-Type': 'application/json'
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
      
      // First, try to add/update contact in Omnisend (simplified)
      await this.addContactSimple(customerData, warrantyData);
      
      // Then send the email using the campaigns endpoint
      const emailData = this.createWarrantyEmailData(customerData, warrantyData);
      
      console.log('📧 Sending email via Omnisend campaigns API...');
      const response = await axios.post(
        `${this.baseUrl}/campaigns`,
        emailData,
        { headers: this.headers }
      );

      console.log('✅ Email campaign created successfully via Omnisend');
      return { 
        success: true, 
        messageId: response.data.campaignID || 'omnisend-campaign',
        message: 'Warranty confirmation email sent successfully'
      };
      
    } catch (error) {
      console.error('❌ Email sending failed:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      });
      
      // Try alternative method - direct email send
      return await this.sendDirectEmail(customerData, warrantyData);
    }
  }

  async sendDirectEmail(customerData, warrantyData) {
    try {
      console.log('📧 Trying direct email send method...');
      
      const emailData = {
        to: customerData.email,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: `✅ Warranty Registration Confirmed - ${warrantyData.product}`,
        content: this.getWarrantyEmailHTML(customerData, warrantyData, warrantyData.warrantyEndDate)
      };

      const response = await axios.post(
        `${this.baseUrl}/messages`,
        emailData,
        { headers: this.headers }
      );

      console.log('✅ Direct email sent successfully');
      return { 
        success: true, 
        messageId: response.data.messageId || 'omnisend-direct',
        message: 'Warranty confirmation email sent via direct method'
      };
      
    } catch (directError) {
      console.error('❌ Direct email also failed:', {
        message: directError.message,
        status: directError.response?.status,
        data: directError.response?.data
      });
      
      return { 
        success: false, 
        error: directError.response?.data || directError.message,
        message: 'All email sending methods failed'
      };
    }
  }

  async addContactSimple(customerData, warrantyData) {
    try {
      console.log('👤 Adding contact to Omnisend...');
      
      const contactData = {
        email: customerData.email,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        phone: customerData.phone || null,
        tags: [
          'warranty-customer',
          `product-${this.getProductCode(warrantyData.product)}`,
          'warranty-active'
        ],
        customProperties: {
          warrantyNumber: warrantyData.warrantyNumber,
          product: warrantyData.product,
          source: warrantyData.source
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/contacts`,
        contactData,
        { headers: this.headers }
      );

      console.log('✅ Contact added to Omnisend successfully');
      return response.data;
    } catch (error) {
      console.log('⚠️ Contact creation failed (continuing anyway):', {
        status: error.response?.status,
        message: error.response?.data?.detail || error.message
      });
      
      // Don't throw error - continue with email sending
      return null;
    }
  }

  createWarrantyEmailData(customer, warranty) {
    return {
      name: `Warranty Confirmation - ${warranty.warrantyNumber}`,
      type: 'regular',
      subject: `✅ Warranty Registration Confirmed - ${warranty.product}`,
      content: {
        html: this.getWarrantyEmailHTML(customer, warranty, warranty.warrantyEndDate)
      },
      recipients: {
        type: 'custom',
        emails: [customer.email]
      },
      sender: {
        email: this.fromEmail,
        name: this.fromName
      }
    };
  }

  getWarrantyEmailHTML(customer, warranty, warrantyEndDate) {
    const endDate = new Date(warrantyEndDate);
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Warranty Registration Confirmed</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; background-color: #f5f5f5; }
        .email-container { max-width: 600px; margin: 0 auto; background: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .content { padding: 30px; }
        .success-badge { background: #28a745; color: white; padding: 10px 20px; border-radius: 25px; display: inline-block; margin-bottom: 20px; }
        .warranty-details { background: #f8f9fa; padding: 20px; border-left: 4px solid #28a745; margin: 20px 0; border-radius: 5px; }
        .customer-info { background: #e3f2fd; padding: 20px; border-left: 4px solid #2196f3; margin: 20px 0; border-radius: 5px; }
        .important { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; border-radius: 5px; }
        .footer { background: #343a40; color: white; padding: 20px; text-align: center; font-size: 14px; }
        .highlight { color: #e74c3c; font-weight: bold; }
        ul { margin: 15px 0; padding-left: 20px; }
        li { margin: 8px 0; }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>🎧 LDAS Electronics</h1>
          <p>Warranty Registration Confirmed</p>
        </div>
        
        <div class="content">
          <div class="success-badge">✅ Registration Successful</div>
          
          <h2>Hello ${customer.firstName} ${customer.lastName},</h2>
          
          <p>Great news! Your warranty registration has been successfully processed. Your <strong>${warranty.product}</strong> is now covered under our comprehensive warranty program.</p>
          
          <div class="warranty-details">
            <h3>🛡️ Warranty Details</h3>
            <p><strong>Product:</strong> ${warranty.product}</p>
            <p><strong>Warranty Number:</strong> ${warranty.warrantyNumber}</p>
            <p><strong>Purchase Date:</strong> ${new Date(warranty.purchaseDate).toLocaleDateString()}</p>
            <p><strong>Warranty Valid Until:</strong> <span class="highlight">${endDate.toLocaleDateString()}</span></p>
            <p><strong>Registration Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Purchase Source:</strong> ${warranty.source}</p>
          </div>

          <div class="customer-info">
            <h3>👤 Customer Information</h3>
            <p><strong>Name:</strong> ${customer.firstName} ${customer.lastName}</p>
            <p><strong>Email:</strong> ${customer.email}</p>
            ${customer.phone ? `<p><strong>Phone:</strong> ${customer.phone}</p>` : ''}
          </div>

          <h3>🎯 What's Next?</h3>
          <ul>
            <li><strong>Keep this email</strong> as proof of your warranty registration</li>
            <li>Your warranty is valid for <strong>12 months</strong> from purchase date</li>
            <li>For warranty claims, contact us with your warranty number: <strong>${warranty.warrantyNumber}</strong></li>
            <li>Visit our website for troubleshooting guides and support</li>
            <li>Follow us on social media for product updates and tips</li>
          </ul>

          <div class="important">
            <p><strong>⚠️ Important:</strong> This warranty covers manufacturing defects and hardware failures under normal use. Physical damage, water damage, and misuse are not covered. Please review our full warranty terms on our website.</p>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>LDAS Electronics Support</strong></p>
          <p>📧 Email: support@ldaselectronics.com | 📞 Phone: 1-800-LDAS-HELP</p>
          <p>🌐 Website: ldas.ca</p>
          <p style="margin-top: 15px;">© 2025 LDAS Electronics. All rights reserved.</p>
          <p style="margin-top: 10px; font-size: 12px; opacity: 0.8;">
            This email was sent to ${customer.email} regarding warranty registration.
          </p>
        </div>
      </div>
    </body>
    </html>`;
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
      console.log('🧪 Testing Omnisend connection...');
      
      // Test basic API access
      const response = await axios.get(
        `${this.baseUrl}/account`,
        { headers: this.headers }
      );
      
      console.log('✅ Omnisend connection successful');
      return {
        success: true,
        message: 'Omnisend connection successful',
        account: response.data.companyName || 'Connected'
      };
    } catch (error) {
      console.error('❌ Omnisend connection failed:', {
        status: error.response?.status,
        message: error.response?.data || error.message
      });
      
      return {
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      };
    }
  }
}

module.exports = EmailService;
