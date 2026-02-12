-- STEP 1: Create Business
INSERT INTO businesses (name)
VALUES ('SmartBiz AI Store');
-- STEP 2: Verify Business Created
SELECT id,
    name
FROM businesses;
-- COPY THE ID FROM ABOVE, then proceed to STEP 3
-- STEP 3: Create Product (Replace THE_BUSINESS_ID with actual UUID from step 2)
-- Example: INSERT INTO products (business_id, name, price, stock_quantity, is_active)
-- VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Premium Sugar', 250, 100, true);
-- UNCOMMENT AND EDIT THE LINE BELOW:
-- INSERT INTO products (business_id, name, price, stock_quantity, is_active)
-- VALUES ('THE_BUSINESS_ID', 'Premium Sugar', 250, 100, true);