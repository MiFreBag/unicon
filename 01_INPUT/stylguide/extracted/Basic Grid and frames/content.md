# Basic Grid and frames

## Page 1

All layout and component constructions are based on standard distances (see below). These standard distances use a 4px (if smaller than 16px) or an 
8px (if larger than 16px) system. 
In practice, this simply means to use increments of 4px/8px to size and space out the elements on a page. Any defined height or width should be 
divisible by 4, including padding, margins and line heights. Thanks to this narrow set of variables, items within a page will align effortlessly and follow 
a consistent pattern. A range of “Spacer”-Components (see above) is available to assist with spacing if necessary. 
Workflow suggestion:
In Figma, you can create Auto layouts to set paddings and 
margins automatically. Using this feature will save you a lot of 
time when constructing UI elements / designing pages.
Basic Grid
Spacings/Grid: 4/8px system
Example
8
12
16
4px increments
24
32
40
48
56
64
72
80
8px increments
Welcome
Username
*
Password
*
•••••••
Forgot password
Language
*
English
Login
48
40
40
24
40
40
16
16
16
48
16
16
16


![Page 1](Basic Grid and frames_page_001.png)

## Page 2

Basic layout - App anatomy
Overview
Dashboard
Grid, full width, 4 columns, flexible height (Analytics)
2 Column (Intersection overview)
Full width & full height (Map)
Our applications integrate three core navigation elements:

App bar (Logo, page title, app specific functions)
Sidebar navigation (multiple levels) - primary navigation
Tab navigation (multiple levels) - secondary navigation

The default spacing between elements is 16px.
Detail information on the sidebar/tab navigation can be found in the “Navigation” page.
App bar
Tab navigation horizontal
Tab navigation 
vertical
Content area
Sidebar navigation
16
16
16
App bar
Tab navigation horizontal
Content area
Sidebar navigation
16
16
16
App bar
Tab navigation horizontal
Tab navigation horizontal - submenu
Content area
Sidebar navigation
16
16
8
16
App bar
Sidebar navigation
16
16
Widget
Widget
Widget
Map
16
16
App bar
Sidebar navigation
16
16
Widget
Widget
Widget
Widget
Widget
Widget
Widget
Widget
Widget
Widget
Widget
Widget
Widget
Widget
Widget
Widget
16
16
16
16
16
16
16
16
16
App bar
Sidebar navigation
16
16
Tab navigation horizontal
Content
Map
16
App bar
Map
Sidebar navigation
16
16
Map
App bar
Tab navigation horizontal
Tab navigation 
vertical
Content area
Sidebar 
navigation 
EXPANDED
16
16
16
App bar
Tab navigation horizontal
Tab navigation 
vertical
Content area
Sidebar navigation
16
16
16
Sidebar 
subnavigation
App bar
Tab navigation horizontal
Tab navigation 
vertical
Sidebar 
subnavigation
PINNED
Content area
Sidebar navigation
16
16
16
Core elements / construction
Sidebar expanded
Sidebar submenu active
Sidebar submenu pinned
Tab navigation, horizontal only
Tab navigation, horizontal with submenu
Note:
Applications that fall under the Minimal Adherence layer may omit any 
navigation element that is not applicable to their app structure. If possible, 
they should try to integrate the styling of navigation items provided in the 
“Navigation” page.

Applications that fall under the Mandatory layer must adhere to the 
navigation structure as well as all the rules defined under “Navigation”.


![Page 2](Basic Grid and frames_page_002.png)

