const axios = require('axios');

class ShopifyService {
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

  // Find customer by email
  async findCustomerByEmail(email) {
    try {
      console.log(`🔍 Searching for customer: ${email}`);
      
      const response = await axios.get(
        `${this.baseUrl}/customers/search.json?query=email:${encodeURIComponent(email)}`,
        { headers: this.headers }
      );

      const customers = response.data.customers;
      return customers.length > 0 ? customers[0] : null;
    } catch (error) {
      console.error('❌ Error finding customer:', error.response?.data || error.message);
      return null;
    }
  }

  // Create new customer with warranty info
  async createCustomerWithWarranty(customerData, warrantyData) {
    try {
      console.log(`➕ Creating new customer: ${customerData.email}`);
      
      const warrantyTags = this.generateWarrantyTags(warrantyData);
      const customerNotes = this.generateWarrantyNotes(warrantyData);
      
      const newCustomer = {
        customer: {
          first_name: customerData.firstName,
          last_name: customerData.lastName,
          email: customerData.email,
          phone: customerData.phone || null,
          tags: warrantyTags.join(', '),
          note: customerNotes
        }
      };

      if (customerData.address) {
        newCustomer.customer.addresses = [{
          address1: customerData.address,
          country: 'Canada'
        }];
      }

      const response = await axios.post(
        `${this.baseUrl}/customers.json`,
        newCustomer,
        { headers: this.headers }
      );

      console.log(`✅ Customer created successfully. ID: ${response.data.customer.id}`);
      return {
        success: true,
        customer: response.data.customer,
        action: 'created'
      };
    } catch (error) {
      console.error('❌ Error creating customer:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        action: 'failed'
      };
    }
  }

  // Update existing customer with new warranty
  async updateCustomerWithWarranty(existingCustomer, warrantyData) {
    try {
      console.log(`✏️ Updating existing customer ID: ${existingCustomer.id}`);
      
      const newWarrantyTags = this.generateWarrantyTags(warrantyData);
      const existingTags = existingCustomer.tags ? existingCustomer.tags.split(', ') : [];
      
      // Merge tags (avoid duplicates)
      const allTags = [...new Set([...existingTags, ...newWarrantyTags])];
      
      const updatedCustomer = {
        customer: {
          id: existingCustomer.id,
          tags: allTags.join(', '),
          note: this.updateCustomerNotes(existingCustomer.note, warrantyData)
        }
      };

      const response = await axios.put(
        `${this.baseUrl}/customers/${existingCustomer.id}.json`,
        updatedCustomer,
        { headers: this.headers }
      );

      console.log(`✅ Customer updated successfully. ID: ${existingCustomer.id}`);
      return {
        success: true,
        customer: response.data.customer,
        action: 'updated'
      };
    } catch (error) {
      console.error('❌ Error updating customer:', error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        action: 'failed'
      };
    }
  }

  // Main function: create or update customer
  async createOrUpdateCustomer(customerData, warrantyData) {
    try {
      console.log(`👤 Processing customer: ${customerData.email}`);
      
      // Check if customer exists
      const existingCustomer = await this.findCustomerByEmail(customerData.email);
      
      if (existingCustomer) {
        // Update existing customer
        return await this.updateCustomerWithWarranty(existingCustomer, warrantyData);
      } else {
        // Create new customer
        return await this.createCustomerWithWarranty(customerData, warrantyData);
      }
    } catch (error) {
      console.error('❌ Error in createOrUpdateCustomer:', error.message);
      return {
        success: false,
        error: error.message,
        action: 'failed'
      };
    }
  }

  // Generate warranty tags for customer segmentation
  generateWarrantyTags(warrantyData) {
    const tags = [
      'warranty-registered',
      `product-${this.getProductCode(warrantyData.product)}`,
      'warranty-active',
      `source-${warrantyData.source.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      `registered-${new Date().getFullYear()}`
    ];

    return tags;
  }

  // Generate customer notes with warranty details
  generateWarrantyNotes(warrantyData) {
    const registrationDate = new Date().toLocaleDateString();
    const warrantyEndDate = new Date(warrantyData.purchaseDate);
    warrantyEndDate.setFullYear(warrantyEndDate.getFullYear() + 1);

    return `WARRANTY REGISTRATION - ${registrationDate}
Product: ${warrantyData.product}
Warranty #: ${warrantyData.warrantyNumber}
Purchase Date: ${new Date(warrantyData.purchaseDate).toLocaleDateString()}
Warranty Valid Until: ${warrantyEndDate.toLocaleDateString()}
Source: ${warrantyData.source}
${warrantyData.orderId ? `Order ID: ${warrantyData.orderId}` : ''}

--- Previous Notes ---
`;
  }

  // Update existing customer notes
  updateCustomerNotes(existingNotes, warrantyData) {
    const newNote = this.generateWarrantyNotes(warrantyData);
    return newNote + (existingNotes || '');
  }

  // Get product code from product name
  getProductCode(productName) {
    const productMap = {
      'LDAS TH11 Headset': 'th11',
      'LDAS G7 Headset': 'g7', 
      'LDAS G10 Headset': 'g10'
    };
    
    return productMap[productName] || 'unknown';
  }

  // Test connection (we already know this works!)
  async testConnection() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/shop.json`,
        { headers: this.headers }
      );

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
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ShopifyService;
