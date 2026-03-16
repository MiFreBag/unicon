# Ecosystem Design Guidelines - Mandatory Layer

## Page 1

Dark mode
Headline
Headline
Headline
Icon variants


![Page 1](Ecosystem Design Guidelines - Mandatory Layer_page_001.png)

## Page 2

App bar
Overview
Submenu
Overview
Construction
The app bar allows users to access app specific functions and preferences. It also contains the app icon/logo (square format), which can act as a 
“home” button to bring the user back to the default page, and the page title (with respective functionalities, e.g. Dashboard > edit).

The app bar is located at the top of the page and spans over the entire width. Its position is fixed and the bar is always visible, even if content can be 
scrolled. The app bar’s height is fixed and matches the width of the sidebar navigation. 

Function icons may have a submenu. They appear on click of the function icon. If a user hovers a function icon, a tooltip appears. 
The submenu aligns right with the frame of the selected function icon with a 4px spacing below. Subnavigation items may feature an icon. If you 
have both, navigation items with and without an icon, please try to group them accordingly for a cleaner look (i.e. items with no icon on top, followed 
by items with an icon, see below).

Please try to use the same width for all subnavigation panels.
Dark mode
Headline
1278
28
96
4
133
user@website.com
Administration
Settings
Integrations
Downloads
Help
Server Details
Logout
Administration
Settings
Integrations
Downloads
Help
Server Details
Logout
Subnavigation
App bar
Administration
Settings
Downloads
Help
Logout
Administration
Settings
Integrations
Downloads
Help
Server Details
Logout
Default, no icon
Default, with icon
Hover, no icon
Hover, with icon
Default (no icon)
Default (with icon)
Hover (no icon)
Hover (with icon)
Submenu Item
Submenu Item
Submenu Item
Submenu Item
Subnavigation item
Headline
1278
28
96
4
133
user@website.com
Headline
1278
28
96
4
133
user@website.com
Headline
1278
28
96
4
133
user@website.com
Headline
1278
4
16
3
133
user@website.com
24px, Regular (400), line-height: 32px
1278
28
96
4
133
16px, Regular (400), line-height: 24px
56
56
App icon: 40px
8
8
8
8
8
8
8
8
8
8
8
8
16
Icons: 16px
Icons: 24px
Icons: 32px
Icon frame: 24px
12px, Semibold (600), line-height: 16px
Icon frame: 32px
24
24
24
32
32
App icon
fixed width
Page title / functions
flexible width
App functions
hug contents
Administration
Settings
Integrations
Downloads
Help
Server Details
Logout
Administration
Settings
Integrations
Downloads
Help
Server Details
Logout
Administration
Settings
Downloads
Help
Logout
Administration
Settings
Integrations
Downloads
Help
Server Details
Logout
Profile
Dark mode
Profile
Dark mode
Descriptive Headline
2025/08/17
16:43
This is copytext. Lorem ipsum dolor sit amet, consetetur 
sadipscing elitr, sed diam nonumy.
Descriptive Headline
2025/08/17
16:43
This is copytext. Lorem ipsum dolor sit amet, consetetur 
sadipscing elitr, sed diam nonumy.
Descriptive Headline
2025/08/17
16:43
This is copytext. Lorem ipsum dolor sit amet, consetetur 
sadipscing elitr, sed diam nonumy.
Descriptive Headline
2025/08/17
16:43
This is copytext. Lorem ipsum dolor sit amet, consetetur 
sadipscing elitr, sed diam nonumy.
Note: 
For details on how to construct these 
alerts, visit the “Notification” page.
Default, no icon
Default, with icon
Hover, no icon
Hover, with icon
Default (no icon)
Default (with icon)
Hover (no icon)
Hover (with icon)
Submenu Item
16px, Regular (400)
line-height: 24px;
Submenu Item
16px, Regular (400)
line-height: 24px;
Submenu Item
16px, Regular (400)
line-height: 24px;
Submenu Item
16px, Regular (400)
line-height: 24px;
8
8
16
16
16
16
16
16
16
16
16
16
16
16
16
16
16
16
Icon: 24px
Icon: 24px
Subnavigation item
stroke: 1px;
corner-radius: 4px;
drop-shadow: 24px, 0px offset


![Page 2](Ecosystem Design Guidelines - Mandatory Layer_page_002.png)

## Page 3

Sidebar Navigation
Overview
Construction & variants
The sidebar navigation is the main navigation item in SWARCO applications and is located right below the horizontal app bar. It constists of:

an icon bar (1st level) and 
a subnavigation (2nd+ level). 

The icon bar is always visible. It can be expanded/collapsed to show navigation item names or save screen space.
The subnavigation is hidden until an item in the icon bar has been clicked and only appears if the selected category has submenu items. It can be 
pinned and then remains active as long as the user is browsing pages of the selected category (or until unpinned).

The width of both sidebar elements is fixed. Their height is variable and fills the available vertical screen space.
They are separated by 1px line.
Inventory
Input Text
By Jurisdiction
By Location
Traffic Controllers
Cameras
Detector Stations
Detectors
Quick Links
Dashboard
Map
Devices
Locations
Analytics
Events
Apps
FAQ / Help
Collapse
Quick Links
Dashboard
Map
Devices
Locations
Analytics
Events
Apps
FAQ / Help
Collapse
Inventory
Input Text
By Jurisdiction
By Location
Traffic Controllers
Cameras
Detector Stations
Detectors
Category name
Breadcrumb item / Breadcrumb item /
Breadcrumb item
Input Text
Subnavigation item
Subnavigation item
Subnavigation item
Subnavigation item
Subnavigation item
Subnavigation item
Icon bar
collapsed, 
56px 
Subnavigation
336px
Icon bar
expanded
variable width; min: 168px; 
Subnavigation
336px
Default
Default
Hover
Hover
Active
Default collapsed
Hover collapsed
Active collapsed
Default expanded
Hover expanded
Active expanded
Default
Pinned
Default
Default (without device state)
Default (with device state)
Hover (without icon)
Hover (with icon)
Hover (with device state with icon)
Default
Breadcrumb item default
Breadcrumb item hover
56
56
56
Apps
56
14px, regular (400)
line-height: 24px;
width: flexible;
Apps
56
14px, regular (400)
line-height: 24px;
width: flexible;
Apps
56
14px, regular (400)
line-height: 24px;
width: flexible;
Category name
16px, Bold (700)
line-height: 24px;
Category name
Breadcrumb item / Breadcrumb item /
Breadcrumb item
Breadcrumb item / Breadcrumb item /
Item
horizontal spacing: 4px;
vertical spacing: 0px;
Subnavigation item
16px; regular (400)
line-height: 24px;
Subnavigation item
16px; regular (400)
line-height: 24px;
Subnavigation item
16px; regular (400)
line-height: 24px;
Subnavigation item
16px; regular (400)
line-height: 24px;
Subnavigation item
16px; regular (400)
line-height: 24px;
Input Text
Input Text
corner-radius: 4px;
padding: 4px;
corner-radius: 4px;
padding: 4px;
Breadcrumb item
Breadcrumb item
14px; regular (400)
14px; regular (400)
8
8
8
12
12
8
8
8
8
8
16
16
16
16
16
16
16
16
16
16
16
16
16
16
16
16
16
16
16
16
16
16
16
16
16
16
12
12
16
16
16
16
16
16
16
16
16
16
8
16
16
8
16
16
16
16
16
16
16
16
16
32
Icon: 24px
Icon: 24px
Icon: 24px
background: 40px
Icon: 24px
Icon: 24px
Icon: 24px
Icons: 16px
Icon frame: 24px
Status dot: 12px
Status dot: 12px
Icon: 16px
Icon: 16px
Input size: Small (height: 32px; width: fill;)
Category Heading
Collapsed
Expanded
Breadcrumb
Subnavigation item
Search
Icon bar
Subnavigation
Note:
For details on how to 
construct input fields, 
visit the “Inputs” page.
24
24
Dark mode
Quick Links
Dashboard
Map
Devices
Locations
Analytics
Events
Apps
FAQ / Help
Collapse
Default
Hover
Active
Collapsed
Expanded
Icon bar
Category name
Breadcrumb item / Breadcrumb item /
Breadcrumb item
Input Text
Subnavigation item
Subnavigation item
Subnavigation item
Subnavigation item
Subnavigation item
Subnavigation item
Default
Hover
Subnavigation
Default
Default
Default
Default (without device state)
Default (with device state)
Hover (without icon)
Hover (with icon)
Hover (with device state with icon)
Default
Breadcrumb item default
Breadcrumb item hover
Category name
Category name
Breadcrumb item / Breadcrumb item /
Breadcrumb item
Subnavigation item
Subnavigation item
Subnavigation item
Subnavigation item
Subnavigation item
Input Text
Breadcrumb item
Breadcrumb item
Category Heading
Breadcrumb
Breadcrumb
Search
Note for designers:
The Sidebar/IconBar and Sidebar/Subnavigation components 
should always be used when creating new designs.

The Sidebar/Subnavigation allows you to adjust a variety of 
variables and thus provides a lot of flexibility. 

Should e.g. more items be needed, please check if you can adjust 
the main components accordingly, instead of detaching the 
element.
stroke: 1px;

8 8
8
8
8
8
8
8
8
8
8
8
8
8


![Page 3](Ecosystem Design Guidelines - Mandatory Layer_page_003.png)

## Page 4

Tab Navigation
Overview
The tab navigation is the secondary navigation option in our applications and nested in the content area. It allows users to browse subpages within 
the selected category (1st level) as well as different content within a subpage (2nd and 3rd level). The tab navigation has three levels: 

The primary horizontal bar is located at the top of the content area (1st level). It allows users to navigate different subpages. Its position is fixed.
The secondary horizontal bar (2nd level) and the vertical bar (3rd level) are located right above / at the left hand of the respective content element. 
They allow users to navigate nested content within a subpage.

Each bar is only visible if the selected category / content item has multiple navigation items.
Overview
Device Editor
Performance
Overview
Device Editor
Performance
Performance
Performance
Unit Config
Phases
Overlaps
Detectors
Coordination
Time Base
Phase Timing
Phase Option
Sequences
Phase Config
Red Light Protect Constants
Red Light Protect Phase
Red Light Protect Detectors
Primary horizontal bar
Navigate subpages
Secondary horizontal bar
Navigate nested content
Vertical bar
Navigate nested content
Construction & variants
Horizontal bar (primary & secondary)
Vertical bar
Default
Special Case: Active with submenu
Default
Active
Disabled
Hover
Hover
Active
Disabled
Default
Default
Hover
Active with submenu
Disabled
Hover
Disabled
Active
Active
Overview
16px, regular (400)
line-height: 24px;
stroke: 1px, bottom, inside
width: variable
Phase Timing
16px, regular (400)
line-height: 24px;
width: variable
Overview
16px, regular (400)
line-height: 24px;
stroke: 1px, bottom, inside
width: variable
Overview
16px,bold (600)
line-height: 24px;
stroke: 2px, bottom, inside
width: variable
Overview
16px, regular (400)
line-height: 24px;
stroke: 1px, bottom, inside
width: variable
Phase Timing
16px, regular (400)
line-height: 24px;
width: variable
Phase Timing
16px, regular (400)
line-height: 24px;
width: variable
Overview
16px, regular (400)
line-height: 24px;
stroke: 2px, bottom, inside
width: variable
Phase Timing
16px, regular (400)
line-height: 24px;
width: variable
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
12
Bar: 1px
Bar: 1px
Bar: 2px
Bar: 1px
Bar: 2px
Bar: 2px
Phase Timing
Phase Option
Sequences
Phase Config
Red Light Protect Constants
Red Light Protect Phase
Red Light Protect Detectors
Dark mode
Overview
Device Editor
Performance
Performance
Horizontal bar (primary & secondary)
Default
Hover
Disabled
Active
Vertical bar
Default
Hover
Active
Disabled
Phase Timing
Phase Option
Sequences
Phase Config
Red Light Protect Constants
Red Light Protect Phase
Red Light Protect Detectors
Note: 
Active tab items don’t 
change color on hover.
Note: 
Active tab items don’t 
change color on hover.


![Page 4](Ecosystem Design Guidelines - Mandatory Layer_page_004.png)

