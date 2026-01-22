# Brand Colors Configuration

This document explains how to update the brand colors to match your logo.

## Current Setup

The system now uses CSS custom properties (CSS variables) for brand colors, making it easy to update colors throughout the entire application.

## How to Extract Colors from Logo

1. **Option 1: Use the provided HTML tool**
   - Open `extract-colors.html` in your browser
   - Upload the logo image (`src/assets/Msimbazi Logo.jpg`)
   - The tool will display the top 10 colors from the logo
   - Copy the hex codes of the primary and secondary colors

2. **Option 2: Use an online tool**
   - Visit https://imagecolorpicker.com/
   - Upload your logo
   - Click on the main colors to get their hex codes

3. **Option 3: Use design software**
   - Open the logo in Photoshop, GIMP, or similar
   - Use the color picker tool to identify main colors

## Updating Brand Colors

Once you have the color hex codes from your logo:

1. Open `index.css`
2. Find the `:root` section with brand color variables
3. Update the following variables with your logo colors:

```css
:root {
  /* Primary Brand Colors - Extract from logo */
  --brand-primary: #YOUR_PRIMARY_COLOR;        /* Main brand color */
  --brand-primary-dark: #YOUR_PRIMARY_DARK;   /* Darker shade (hover states) */
  --brand-primary-light: #YOUR_PRIMARY_LIGHT;  /* Lighter shade */
  --brand-primary-50: #YOUR_PRIMARY_50;       /* Very light tint */
  --brand-primary-100: #YOUR_PRIMARY_100;     /* Light tint */
  
  /* Secondary Brand Colors - Extract from logo */
  --brand-secondary: #YOUR_SECONDARY_COLOR;    /* Secondary/accent color */
  --brand-secondary-dark: #YOUR_SECONDARY_DARK; /* Darker shade */
  --brand-secondary-light: #YOUR_SECONDARY_LIGHT; /* Lighter shade */
  --brand-secondary-50: #YOUR_SECONDARY_50;    /* Very light tint */
  --brand-secondary-100: #YOUR_SECONDARY_100; /* Light tint */
}
```

## Color Shade Generator

To generate lighter/darker shades from your main colors, you can:

1. Use an online tool like https://coolors.co/ or https://maketintsandshades.com/
2. Manually adjust brightness:
   - For lighter shades: increase brightness or add white
   - For darker shades: decrease brightness or add black
   - For tints (50, 100): use very light versions (almost white with a hint of color)

## Where Colors Are Used

The brand colors are automatically applied throughout the system:
- Login page header and buttons
- Sidebar navigation
- Primary action buttons
- Focus states on form inputs
- Links and interactive elements
- Status indicators (where appropriate)

## Testing

After updating colors:
1. Save `index.css`
2. Refresh your browser
3. Check all pages to ensure colors look good
4. Test interactive states (hover, focus, active)

## Notes

- Semantic colors (success, danger, warning) remain unchanged for consistency
- The system uses Tailwind CSS with custom brand color classes
- All brand color references use the `brand-` prefix (e.g., `bg-brand-primary`)
