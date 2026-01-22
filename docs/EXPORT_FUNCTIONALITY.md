# Export Functionality - PDF, Excel, and CSV

## ✅ **YES - All Reports Can Be Exported in PDF, Excel, and CSV Formats**

The system now supports comprehensive export functionality for all reports in **three formats**: PDF, Excel (XLSX), and CSV.

## Export Formats Available

### 1. **PDF Export** 📄
- **Format**: Professional PDF documents
- **Features**:
  - Branded header with MSIMBAZI EYE CARE logo
  - Formatted tables with auto-table plugin
  - Summary sections
  - Multiple pages support
  - Page numbers and footers
  - Date range and period information
  - Color-coded headers (brand green)

### 2. **Excel Export** 📊
- **Format**: XLSX (Excel 2007+)
- **Features**:
  - Multiple worksheets (Summary, Tables)
  - Auto-sized columns
  - Formatted headers
  - Merged cells for titles
  - All data organized in separate sheets
  - Ready for analysis and pivot tables

### 3. **CSV Export** 📋
- **Format**: Comma-separated values
- **Features**:
  - Universal compatibility
  - Easy to import into any system
  - Lightweight format
  - All data included

## Reports with Export Functionality

### ✅ **Reports & Analytics Module**
**Location**: Manager and Admin dashboard

**Export Options**:
- PDF, Excel, CSV

**Data Included**:
- **Summary Metrics**:
  - Total Patients
  - Completed Patients
  - Total Revenue
  - Insurance Coverage
  - Net Revenue
  - Average Bill Amount
  - Insurance breakdown (NHIF, Private, Cash)

- **Department Activity Table**:
  - Clinical department metrics
  - Pharmacy activity
  - Optical services
  - Billing queue status

- **Insurance Breakdown Table**:
  - NHIF coverage amounts
  - Private insurance coverage
  - Cash payments

- **Revenue by Category Table**:
  - Clinical services revenue
  - Pharmacy revenue
  - Optical services revenue
  - Percentage breakdowns

- **Patient Details Table** (if applicable):
  - Patient ID
  - Name
  - Gender
  - Check-in Date
  - Insurance Type
  - Status
  - Total Bill Amount

**Period Filtering**:
- Today
- Last 7 Days
- This Month
- This Year

### ✅ **Audit Logs Module**
**Location**: Admin dashboard

**Export Options**:
- PDF, Excel, CSV

**Data Included**:
- Filter information (Action, User, Date Range)
- Audit log entries (when available)
- System activity records

## How to Use Export Functionality

### Step 1: Navigate to Reports
1. Log in as **Manager** or **Admin**
2. Click on **"Reports & Analytics"** in the sidebar

### Step 2: Select Time Period
1. Use the dropdown to select:
   - Today
   - Last 7 Days
   - This Month
   - This Year

### Step 3: Export Report
1. Click the **"Export Report"** button
2. A dropdown menu will appear with three options:
   - **Export as PDF** 📄
   - **Export as Excel** 📊
   - **Export as CSV** 📋

### Step 4: Download
1. Click your preferred format
2. The file will automatically download
3. File naming format: `msimbazi-reports-&-analytics-{period}-{date}.{ext}`

## Export File Naming Convention

All exported files follow this naming pattern:
```
msimbazi-{report-title}-{period}-{date}.{extension}
```

**Examples**:
- `msimbazi-reports-&-analytics-today-2025-01-15.pdf`
- `msimbazi-reports-&-analytics-month-2025-01-15.xlsx`
- `msimbazi-audit-logs-today-2025-01-15.csv`

## Technical Implementation

### Libraries Used

1. **jsPDF** (`jspdf`)
   - PDF generation
   - Text and formatting
   - Page management

2. **jspdf-autotable** (`jspdf-autotable`)
   - Table generation in PDF
   - Styling and formatting
   - Multi-page table support

3. **xlsx** (`xlsx`)
   - Excel file generation
   - Multiple worksheets
   - Column formatting

### Export Utility Functions

**Location**: `utils/exportUtils.ts`

**Functions**:
- `exportToPDF(data: ExportData): void`
- `exportToExcel(data: ExportData): void`
- `exportToCSV(data: ExportData): void`
- `formatCurrency(amount: number): string`
- `formatPercentage(value: number, total: number): string`

### Export Data Structure

```typescript
interface ExportData {
  title: string;
  period?: string;
  dateRange?: { start: string; end: string };
  summary?: Array<{ label: string; value: string | number }>;
  tables?: Array<{
    title: string;
    headers: string[];
    rows: (string | number)[][];
  }>;
  metadata?: Record<string, string | number>;
}
```

## PDF Export Features

### Styling
- **Header**: Brand green color (#006633)
- **Title**: Centered, bold
- **Tables**: Brand green headers with white text
- **Alternate Rows**: Light gray background
- **Footer**: Page numbers and generation date

### Layout
- **Page Size**: A4 (standard)
- **Margins**: 14mm left/right
- **Font**: Helvetica
- **Auto Page Breaks**: Tables split across pages automatically

## Excel Export Features

### Worksheets
1. **Summary Sheet**:
   - Report information
   - Summary metrics
   - Formatted headers

2. **Table Sheets**:
   - One sheet per data table
   - Auto-sized columns
   - Formatted headers

### Formatting
- **Column Widths**: Auto-sized based on content
- **Merged Cells**: For titles and headers
- **Data Types**: Properly formatted (text, numbers, dates)

## CSV Export Features

### Formatting
- **Comma Separated**: Standard CSV format
- **Quote Escaping**: Handles commas and quotes in data
- **Newline Support**: Multi-line cells properly escaped
- **Headers**: Included for all sections

## Browser Compatibility

### Supported Browsers
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Opera (latest)

### Requirements
- Modern browser with JavaScript enabled
- File download permissions
- Sufficient disk space

## File Sizes

Typical file sizes:
- **PDF**: 50-200 KB (depending on data)
- **Excel**: 30-150 KB (depending on data)
- **CSV**: 10-100 KB (depending on data)

## Future Enhancements

Potential future additions:
- [ ] Email export functionality
- [ ] Scheduled report generation
- [ ] Custom report templates
- [ ] Chart/graph exports
- [ ] Print-friendly PDF layouts
- [ ] Batch export (multiple periods)
- [ ] Export history tracking

## Troubleshooting

### Export Not Working
1. **Check Browser Console**: Look for JavaScript errors
2. **Check File Permissions**: Ensure downloads are allowed
3. **Check Disk Space**: Ensure sufficient space available
4. **Try Different Format**: If one format fails, try another

### PDF Issues
- Ensure `jspdf` and `jspdf-autotable` are installed
- Check browser PDF viewer compatibility

### Excel Issues
- Ensure `xlsx` library is installed
- Check if Excel can open XLSX files (requires Excel 2007+)

### CSV Issues
- CSV should work in any text editor or spreadsheet application
- Check for special characters that might need escaping

## Summary

✅ **All reports can be exported in PDF, Excel, and CSV formats**

**Available in**:
- Reports & Analytics module (Manager/Admin)
- Audit Logs module (Admin)

**Formats**:
- PDF (professional documents)
- Excel (XLSX spreadsheets)
- CSV (comma-separated values)

**Features**:
- Period-based filtering
- Comprehensive data export
- Branded formatting
- Multiple tables and summaries
- Auto-generated filenames

---

**Status**: ✅ **COMPLETE**  
**Last Updated**: January 2025
