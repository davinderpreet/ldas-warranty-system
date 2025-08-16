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
  }

  async sendWarrantyConfirmation(customerData, warrantyData) {
    try {
      console.log('📧 Sending warranty confirmation email to:', customerData.email);
      
      // First, add/update contact in Omnisend
      await this.addContact(customerData, warrantyData);
      
      // Then send the email
      const emailData = this.createWarrantyEmailData(customerData, warrantyData);
      
      const response = await axios.post(
        `${this.baseUrl}/emails`,
        emailData,
        { headers: this.headers }
      );

      console.log('✅ Email sent successfully via Omnisend');
      return { 
        success: true, 
        messageId: response.data.emailID || 'omnisend-email',
        message: 'Warranty confirmation email sent successfully'
      };
      
    } catch (error) {
      console.error('❌ Email sending failed:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data || error.message,
        message: 'Failed to send confirmation email'
      };
    }
  }

  async addContact(customerData, warrantyData) {
    try {
      const contactData = {
        email: customerData.email,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        phone: customerData.phone || null,
        tags: [
          'warranty-customer',
          `product-${this.getProductCode(warrantyData.product)}`,
          'warranty-active',
          `source-${warrantyData.source.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
        ],
        customProperties: {
          warrantyNumber: warrantyData.warrantyNumber,
          product: warrantyData.product,
          purchaseDate: warrantyData.purchaseDate,
          warrantyEndDate: warrantyData.warrantyEndDate,
          source: warrantyData.source
        }
      };

      await axios.post(
        `${this.baseUrl}/contacts`,
        contactData,
        { headers: this.headers }
      );

      console.log('✅ Contact added/updated in Omnisend');
    } catch (error) {
      console.log('⚠️ Contact update failed (but continuing with email):', error.response?.data?.title || error.message);
    }
  }

  createWarrantyEmailData(customer, warranty) {
    const warrantyEndDate = new Date(warranty.purchaseDate);
    warrantyEndDate.setFullYear(warrantyEndDate.getFullYear() + 1);

    return {
      to: [
        {
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName
        }
      ],
      from: {
        email: this.fromEmail,
        name: this.fromName
      },
      subject: `✅ Warranty Registration Confirmed - ${warranty.product}`,
      content: {
        html: this.getWarrantyEmailHTML(customer, warranty, warrantyEndDate),
        text: this.getWarrantyEmailText(customer, warranty, warrantyEndDate)
      }
    };
  }

  getWarrantyEmailHTML(customer, warranty, warrantyEndDate) {
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
            <p><strong>Warranty Valid Until:</strong> <span class="highlight">${warrantyEndDate.toLocaleDateString()}</span></p>
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
          <p>📧 Email: support@ldaselectronics.com | 📞 Phone: 1-437-777-8300</p>
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

  getWarrantyEmailText(customer, warranty, warrantyEndDate) {
    return `
LDAS ELECTRONICS - WARRANTY REGISTRATION CONFIRMED

Hello ${customer.firstName} ${customer.lastName},

Your warranty registration has been successfully processed!

WARRANTY DETAILS:
- Product: ${warranty.product}
- Warranty Number: ${warranty.warrantyNumber}
- Purchase Date: ${new Date(warranty.purchaseDate).toLocaleDateString()}
- Warranty Valid Until: ${warrantyEndDate.toLocaleDateString()}
- Registration Date: ${new Date().toLocaleDateString()}
- Purchase Source: ${warranty.source}

CUSTOMER INFORMATION:
- Name: ${customer.firstName} ${customer.lastName}
- Email: ${customer.email}
${customer.phone ? `- Phone: ${customer.phone}` : ''}

WHAT'S NEXT:
- Keep this email as proof of warranty registration
- Warranty is valid for 12 months from purchase date
- For claims, reference warranty number: ${warranty.warrantyNumber}
- Contact support@ldaselectronics.com for assistance

IMPORTANT: This warranty covers manufacturing defects and hardware failures under normal use. Physical damage, water damage, and misuse are not covered.

LDAS Electronics Support
Email: support@ldaselectronics.com
Phone: 1-437-777-8300
Website: ldas.ca

© 2025 LDAS Electronics. All rights reserved.
`;
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
      const response = await axios.get(
        `${this.baseUrl}/contacts?limit=1`,
        { headers: this.headers }
      );
      
      return {
        success: true,
        message: 'Omnisend connection successful',
        contacts: response.data.contacts ? response.data.contacts.length : 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }
}

module.exports = EmailService;
