-- ============================================
-- Inventory & Operations Database Migration
-- Comprehensive Inventory Management System for Minuteserv
-- ============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. SUPPLIERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone_number VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    gst_number VARCHAR(50),
    pan_number VARCHAR(20),
    payment_terms VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES admin_users(id)
);

-- Indexes for suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);

-- ============================================
-- 2. PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) UNIQUE,
    description TEXT,
    category VARCHAR(100),
    unit VARCHAR(50) DEFAULT 'piece', -- piece, kg, liter, box, etc.
    cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    selling_price DECIMAL(10, 2),
    minimum_stock_level INTEGER DEFAULT 0,
    current_stock INTEGER DEFAULT 0,
    reorder_point INTEGER DEFAULT 0,
    supplier_id UUID REFERENCES suppliers(id),
    image_url TEXT,
    barcode VARCHAR(100),
    brand VARCHAR(100),
    expiry_date DATE,
    batch_number VARCHAR(100),
    location VARCHAR(255), -- Storage location
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES admin_users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for products
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_current_stock ON products(current_stock);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(current_stock) WHERE current_stock <= minimum_stock_level;

-- ============================================
-- 3. SERVICE KITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS service_kits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    service_id UUID REFERENCES services(id),
    total_cost DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES admin_users(id)
);

-- Indexes for service_kits
CREATE INDEX IF NOT EXISTS idx_service_kits_service_id ON service_kits(service_id);
CREATE INDEX IF NOT EXISTS idx_service_kits_is_active ON service_kits(is_active);

-- ============================================
-- 4. SERVICE KIT ITEMS TABLE (Many-to-Many: Kits -> Products)
-- ============================================
CREATE TABLE IF NOT EXISTS service_kit_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kit_id UUID NOT NULL REFERENCES service_kits(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(kit_id, product_id)
);

-- Indexes for service_kit_items
CREATE INDEX IF NOT EXISTS idx_service_kit_items_kit_id ON service_kit_items(kit_id);
CREATE INDEX IF NOT EXISTS idx_service_kit_items_product_id ON service_kit_items(product_id);

-- ============================================
-- 5. PARTNER KIT ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS partner_kit_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    kit_id UUID NOT NULL REFERENCES service_kits(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    assigned_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    return_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'assigned', -- assigned, returned, lost, damaged
    notes TEXT,
    assigned_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for partner_kit_assignments
CREATE INDEX IF NOT EXISTS idx_partner_kit_assignments_partner_id ON partner_kit_assignments(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_kit_assignments_kit_id ON partner_kit_assignments(kit_id);
CREATE INDEX IF NOT EXISTS idx_partner_kit_assignments_status ON partner_kit_assignments(status);

-- ============================================
-- 6. STOCK MOVEMENTS TABLE (Inventory Transactions)
-- ============================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL, -- purchase, sale, adjustment, transfer, return, damaged, expiry
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    unit_cost DECIMAL(10, 2),
    total_cost DECIMAL(10, 2),
    reference_type VARCHAR(50), -- purchase_order, booking, adjustment, etc.
    reference_id UUID,
    notes TEXT,
    movement_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for stock_movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_date ON stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- ============================================
-- 7. PURCHASE ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(100) UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id),
    order_date DATE NOT NULL,
    expected_delivery_date DATE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, ordered, received, cancelled
    total_amount DECIMAL(10, 2) DEFAULT 0,
    tax_amount DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    created_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for purchase_orders
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_number ON purchase_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_date ON purchase_orders(order_date);

-- ============================================
-- 8. PURCHASE ORDER ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_cost DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    received_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for purchase_order_items
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product_id ON purchase_order_items(product_id);

-- ============================================
-- 9. STOCK ALERTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stock_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- low_stock, out_of_stock, reorder, expiry
    current_stock INTEGER NOT NULL,
    threshold_stock INTEGER NOT NULL,
    message TEXT,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for stock_alerts
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product_id ON stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_alert_type ON stock_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_is_resolved ON stock_alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_unresolved ON stock_alerts(is_resolved) WHERE is_resolved = false;

-- ============================================
-- 10. PRODUCT COST TRACKING TABLE (Cost per Service)
-- ============================================
CREATE TABLE IF NOT EXISTS service_product_costs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_used DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit_cost DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    effective_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES admin_users(id),
    UNIQUE(service_id, product_id, effective_date)
);

-- Indexes for service_product_costs
CREATE INDEX IF NOT EXISTS idx_service_product_costs_service_id ON service_product_costs(service_id);
CREATE INDEX IF NOT EXISTS idx_service_product_costs_product_id ON service_product_costs(product_id);
CREATE INDEX IF NOT EXISTS idx_service_product_costs_effective_date ON service_product_costs(effective_date);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_kits_updated_at BEFORE UPDATE ON service_kits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_kit_items_updated_at BEFORE UPDATE ON service_kit_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partner_kit_assignments_updated_at BEFORE UPDATE ON partner_kit_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_order_items_updated_at BEFORE UPDATE ON purchase_order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_product_costs_updated_at BEFORE UPDATE ON service_product_costs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-generate purchase order number
CREATE OR REPLACE FUNCTION generate_purchase_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
        NEW.order_number := 'PO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                            LPAD(NEXTVAL('purchase_order_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create sequence for purchase order numbers
CREATE SEQUENCE IF NOT EXISTS purchase_order_seq;

-- Trigger for auto-generating PO number
CREATE TRIGGER generate_purchase_order_number_trigger
    BEFORE INSERT ON purchase_orders
    FOR EACH ROW
    WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
    EXECUTE FUNCTION generate_purchase_order_number();

-- Function to update product stock when stock movement is created
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
DECLARE
    v_previous_stock INTEGER;
    v_new_stock INTEGER;
BEGIN
    -- Get current stock
    SELECT current_stock INTO v_previous_stock FROM products WHERE id = NEW.product_id;
    
    -- Calculate new stock based on movement type
    CASE NEW.movement_type
        WHEN 'purchase', 'return', 'adjustment_increase' THEN
            v_new_stock := v_previous_stock + NEW.quantity;
        WHEN 'sale', 'damaged', 'expiry', 'adjustment_decrease' THEN
            v_new_stock := v_previous_stock - NEW.quantity;
        WHEN 'transfer_out' THEN
            v_new_stock := v_previous_stock - NEW.quantity;
        WHEN 'transfer_in' THEN
            v_new_stock := v_previous_stock + NEW.quantity;
        ELSE
            v_new_stock := v_previous_stock;
    END CASE;
    
    -- Update product stock
    UPDATE products 
    SET current_stock = v_new_stock,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.product_id;
    
    -- Set previous_stock and new_stock in the movement record
    NEW.previous_stock := v_previous_stock;
    NEW.new_stock := v_new_stock;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update stock on movement
CREATE TRIGGER update_product_stock_trigger
    BEFORE INSERT ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stock();

-- Function to check and create stock alerts
CREATE OR REPLACE FUNCTION check_stock_alerts()
RETURNS TRIGGER AS $$
DECLARE
    v_minimum_stock INTEGER;
    v_reorder_point INTEGER;
BEGIN
    SELECT minimum_stock_level, reorder_point 
    INTO v_minimum_stock, v_reorder_point
    FROM products 
    WHERE id = NEW.product_id;
    
    -- Check if stock is below minimum level
    IF NEW.new_stock <= 0 THEN
        -- Out of stock alert
        INSERT INTO stock_alerts (product_id, alert_type, current_stock, threshold_stock, message)
        VALUES (NEW.product_id, 'out_of_stock', NEW.new_stock, 0, 
                'Product is out of stock')
        ON CONFLICT DO NOTHING;
    ELSIF NEW.new_stock <= v_minimum_stock THEN
        -- Low stock alert
        INSERT INTO stock_alerts (product_id, alert_type, current_stock, threshold_stock, message)
        VALUES (NEW.product_id, 'low_stock', NEW.new_stock, v_minimum_stock, 
                'Product stock is below minimum level')
        ON CONFLICT DO NOTHING;
    ELSIF NEW.new_stock <= v_reorder_point AND v_reorder_point > 0 THEN
        -- Reorder alert
        INSERT INTO stock_alerts (product_id, alert_type, current_stock, threshold_stock, message)
        VALUES (NEW.product_id, 'reorder', NEW.new_stock, v_reorder_point, 
                'Product has reached reorder point')
        ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to create stock alerts
CREATE TRIGGER check_stock_alerts_trigger
    AFTER INSERT ON stock_movements
    FOR EACH ROW
    EXECUTE FUNCTION check_stock_alerts();

-- Function to calculate service kit total cost
CREATE OR REPLACE FUNCTION calculate_kit_total_cost()
RETURNS TRIGGER AS $$
DECLARE
    v_total_cost DECIMAL(10, 2);
BEGIN
    SELECT COALESCE(SUM(total_cost), 0) INTO v_total_cost
    FROM service_kit_items
    WHERE kit_id = COALESCE(NEW.kit_id, OLD.kit_id);
    
    UPDATE service_kits
    SET total_cost = v_total_cost,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.kit_id, OLD.kit_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger to update kit cost when items change
CREATE TRIGGER update_kit_cost_trigger
    AFTER INSERT OR UPDATE OR DELETE ON service_kit_items
    FOR EACH ROW
    EXECUTE FUNCTION calculate_kit_total_cost();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE suppliers IS 'Supplier/vendor information';
COMMENT ON TABLE products IS 'Product inventory items';
COMMENT ON TABLE service_kits IS 'Service kits containing multiple products';
COMMENT ON TABLE service_kit_items IS 'Products in each service kit';
COMMENT ON TABLE partner_kit_assignments IS 'Kits assigned to partners';
COMMENT ON TABLE stock_movements IS 'All inventory transactions';
COMMENT ON TABLE purchase_orders IS 'Purchase orders from suppliers';
COMMENT ON TABLE purchase_order_items IS 'Items in purchase orders';
COMMENT ON TABLE stock_alerts IS 'Stock level alerts and notifications';
COMMENT ON TABLE service_product_costs IS 'Cost tracking per service per product';

