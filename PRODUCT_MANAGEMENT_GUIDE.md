# Product Management Guide

We have enhanced the Product Management system to support detailed product listings with images and flexible pricing/stock options.

## Features

1. **Rich Product Details**
    - **Product Name**: Primary identifier.
    - **Category**: Group your products (e.g., "Vegetables").
    - **Description**: Detailed information about the product.

2. **Flexible Pricing**
    - **Currency Support**: Choose between **Rs** (Rupees) or **$** (Dollars).
    - **Price**: Set the unit price.

3. **Advanced Stock Management**
    - **Stock Units**:
        - **Quantity (Qty)**: For discrete items (e.g., 5 Packets).
        - **Kg**: For weight-based items (e.g., 1.5 Kg).
    - **Decimals Supported**: You can enter fractional stock for Kg (e.g., 0.500 Kg).

4. **Product Images**
    - **Direct Upload**: Upload images directly from your device.
    - **URL Support**: Or paste an image URL if hosted elsewhere.
    - Images are displayed in the product list.

5. **Edit & Delete**
    - **Edit**: Update any detail of an existing product easily.
    - **Delete**: Remove products that are no longer needed.

## Database Updates

The following updates were applied to the database:

- Added `currency` (text) and `stock_unit` (text) columns.
- Changed `stock_quantity` to `NUMERIC` to support decimals.
- Created a storage bucket `product-images` with public read access.

## How to Use

1. Go to the **Products** page.
2. Click **"Add Product"**.
3. Fill in the details.
    - Select Currency (Rs/$).
    - Select Unit (Qty/Kg).
    - Upload an image or paste a URL.
4. Click **Save Product**.

To edit, click the **Edit** (pencil) icon on any product row.
To delete, click the **Trash** icon.
