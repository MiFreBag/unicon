# Ecosystem Design Guidelines - Mandatory Layer-10

## Page 1

Layout - Map
Overview
Core elements & construction
Toolbar
Device state dots
Function icon subnavigation
Construction
The map page features a full width and full height map that users can navigate and interact with - either with the device icons in the map or the 
function icons / map controls on either side.  
The map uses some unique UI elements which are detailed below. 
The subnavigation panels is top aligned and to the left of the active function icon with a spacing 4px spacing. It appears only for function icons 
that have a submenu. 

In order to minimize vertical screenspace usage and to accomodate many items, it features an accordion-style behavior that allows for items to be 
categorized and only visible on click. Only one category can be active/expanded at a time. 
Map
1278
28
96
4
133
user@website.com
48
1278
28
96
4
133
user@website.com
1278
28
96
4
133
user@website.com
16
16
16
16
16
16
8
8
8
8
8
Default
OK
OK
Default
Hover
Alert: Info
Alert: Info
Alert: Severe
Alert: Severe
Alert: Critical
Alert: Critical
Disabled / Offline
Disabled / Offline
Default
Hover
Hover
Active
Active/Expanded
Category item
Subcategory item
32
32
32
32
Icons: 16px
Icon frame: 32px
stroke: 1px; 
corner-radius: 4px;
12px, Medium (500), line-height: 16px;
Note: 
For more details on interactive icon 
states, please visit the “Icons” page.
Note:
For more details on 
how to construct the 
hover modal, please 
visit the “Modals” 
page.
Note:
For more details on device state 
colors, please visit the “Colors” page.
Category name
Category item
Category item
Category item
SubCategory item
SubCategory item
Category item
Category name
Category name
Default
Hover
Active/Expanded
Default (checkbox)
Default (checkbox)
Default (radiobutton)
Default (radiobutton)
Category name
56
16px, Bold (700)
line-height: 24px;
Category name
Category name
Category item
48
16px, Regular (400)
line-height: 24px;
SubCategory item
48
SubCategory item
line-height: 24px;
Category item
48
16px, Regular (400)
line-height: 24px;
SubCategory item
48
SubCategory item
line-height: 24px;
8
16
8
8
8
8
12
12
12
12
24
56
56
24
24
16
16
12
12
12
12
12
12
12
12
16
16
16
Icons: 16px
Input: 24px
Input: 24px
Input: 24px
Input: 24px
Category Heading
Category items
Category items
Note:
For details on how to 
construct checkboxes/
radiobuttons, visit the 
“Inputs” page.
Category name
Category item
Category item
Category item
SubCategory item
SubCategory item
Category item
Category name
Category name
Category name
Category item
Category item
Category item
SubCategory item
SubCategory item
Category item
Category name
Category name
stroke: 1px; 
corner-radius: 4px;
drop-shadow: 24px, 0px offset
Additional spacing
when expanded
stroke: 1px; 
Toolbar
Function icons
Function icon
50
50
50
50
50
50
50
50
50
50
50
?
?
?
?
!
!
!
!
!
!
!
50
50
50
50
50
50
50
50
50
50
Map view
height: 200px;
width: 512px;
Intersection name
Pill Text
Intersection name
Intersection details
Map view
height: 200px;
width: 512px;
Intersection name
Pill Text
Intersection name
Intersection details
Dark mode
Map
1278
28
96
4
133
user@website.com
50
50
50
50
50
50
50
50
50
50
50
?
?
?
?
!
!
!
!
!
!
!
Map view
height: 200px;
width: 512px;
Intersection name
Pill Text
Intersection name
Intersection details
Map view
height: 200px;
width: 512px;
Intersection name
Pill Text
Intersection name
Intersection details


![Page 1](Ecosystem Design Guidelines - Mandatory Layer-10_page_001.png)

