# Ecosystem Design Guidelines - Mandatory Layer-3

## Page 1

Inputs - Textfields
Overview
Textfields are the primary choice for user editable data. They come in different sizes, layout variants and states.
Each of these can be accessed easily through the inputs/textfield main component. 
Every style/size variant 
can easily be accessed 
via variables. 
States
Textfields have five different states: 

Default
Hover
Focus
Disabled / Locked
Error
Optional label
*
Input Text
Optional label
*
Input Text
Optional label
*
Input Text
Optional label
*
Input Text
Input Text
Optional label
*
Input Text
Optional label
*
Input Text
Optional label
*
Input Text
Optional label
*
Input Text
Optional label
*
Input Text
Optional label
*
Input Text
Optional label
*
Input Text
Error message
Default
No icon
No icon
No icon
No icon
With icon
With icon
With icon
With error text
With error text
With error text
Icon left
Icon right
No label
Default empty
Hover
Hover empty
Focus
Focus empty
Disabled / Locked
Error
Dark mode
Optional label
*
Input Text
Optional label
*
Input Text
Optional label
*
Input Text
Optional label
*
Input Text
Optional label
*
Input Text
Optional label
*
Input Text
Optional label
*
Input Text
Optional label
*
Input Text
Error message
Default
Default empty
Hover
Hover empty
Focus
Focus empty
Disabled / Locked
Error
Variants & construction
Layout variants
Sizes and construction
Textfields may feature an icon, either on the left or right side. Label text is optional and can be omitted.
Textfields have a flexible width, while their height is fixed. If multiple textfields are present, opt for a consistent width.
Medium, 40px height
Large, 48px height
Small, 32px height
Optional label
*
Input Text
40
14px, Semibold (600), line-height: 16px
*
16px, Regular (400), line-height: 24px
4px spacing between label/input
stroke: 2px;
corner-radius: 4px;
Optional label
*
Input Text
48
14px, Semibold (600), line-height: 16px
*
16px, Regular (400), line-height: 24px
4px spacing between label/input
stroke: 2px;
corner-radius: 4px;
Optional label
*
Input Text
40
14px, Semibold (600), line-height: 16px
*
16px, Regular (400), line-height: 24px
4px spacing between label/input
stroke: 2px;
corner-radius: 4px;
Optional label
*
Input Text
48
14px, Semibold (600), line-height: 16px
*
16px, Regular (400), line-height: 24px
4px spacing between label/input
stroke: 2px;
corner-radius: 4px;
Optional label
*
Input Text
32
14px, Semibold (600), lh: 16px
*
14px, Regular (400), line-height: 16px
4px spacing between label/input
stroke: 2px;
corner-radius: 4px;
Optional label
*
Input Text
Error message
32
14px, Semibold (600), lh: 16px
*
14px, Regular (400), line-height: 16px
Error message
stroke: 2px;
corner-radius: 4px;
4px spacing between label/input
Optional label
*
Input Text
32
14px, Semibold (600), lh: 16px
*
14px, Regular (400), line-height: 16px
4px spacing between label/input
stroke: 2px;
corner-radius: 4px;
Optional label
*
Input Text
Error message
40
14px, Semibold (600), line-height: 16px
*
16px, Regular (400), line-height: 24px
Error message
stroke: 2px;
corner-radius: 4px;
4px spacing between error/input
Optional label
*
Input Text
Error message
48
14px, Semibold (600), line-height: 16px
*
16px, Regular (400), line-height: 24px
Error message
stroke: 2px;
corner-radius: 4px;
4px spacing between error/input
Icon: 16px
Icon: 12px
8
8
16
16
16
12
16
16
16
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
8
8
8
8
8
8
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
This is the primary input size. Use other input sizes sparingly and only in dedicated areas.
Note:
This input size is used for the sidebar 
subnavigation search field. For more details visit 
the “Navigation” page.
Icon: 16px


![Page 1](Ecosystem Design Guidelines - Mandatory Layer-3_page_001.png)

## Page 2

Inputs - Select/Dropdown
Overview
Every style/size variant 
can easily be accessed 
via variables. 
Optional label
*
Select Text
Optional label
*
Selected item
Optional label
*
Selected item
Optional label
*
Selected item
Optional label
*
Selected item
Optional label
*
Selected item
Optional label
*
Selected item
Optional label
*
Select Text
Optional label
*
Select Text
Optional label
*
Select Text
Optional label
*
Select Text
Optional label
*
Select Text
Optional label
*
Select Text
Optional label
*
Select Text
Error message
Default
Default unselected
Hover
Hover unselected
Focus
Focus unselected
Disabled / Locked
Error
Dark mode
Optional label
*
Select Text
Optional label
*
Select Text
Optional label
*
Select Text
Optional label
*
Select Text
Optional label
*
Select Text
Optional label
*
Select Text
Optional label
*
Select Text
Optional label
*
Select Text
Error message
Default
Default unselected
Hover
Hover unselected
Focus
Focus unselected
Disabled / Locked
Error
Dark mode
Optional label
*
Selected item
Optional label
*
Selected item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
(UTC-12:00) International Date Line West
(UTC-11:00) Coordinated Universal Time-11 
(UTC-10:00) Hawaii 
(UTC-09:00) Alaska 
(UTC-08:00) Baja California 
(UTC-08:00) Pacific Time (US and Canada) 
Default
Scrollbar
Filtering - no input
Time Zone
*
Search...
(UTC-03:30) Newfoundland
(UTC-03:00) Brasilia
(UTC-03:00) Greenland
(UTC-03:00) Cayenne, Fortaleza
(UTC-03:00) Buenos Aires
(UTC-03:00) Montevideo
Filtering - with input
Time Zone
*
03:
Select inputs follow the exact same construction rules of textfields, with an additional drowdown when 
active. They also have the same states/visuality. 

In terms of visuality, they are basically an input field with a downwards/upwards pointing chevron on the right.

This section will therefore focus mainly on dropdowns and their variants/construction. Information on how to 
construct the select inputs is covered in the “Textfields” section on the left.  
Select inputs can be large, medium or small in size, with medium being the primary input size. For more details on variants, sizes and 
construction, please refer to the “Textfields” section on the left.
Select input
Dropdowns
Behavior
States
Sizes & construction
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
(UTC-12:00) International Date Line West
(UTC-11:00) Coordinated Universal Time-11 
(UTC-10:00) Hawaii 
(UTC-09:00) Alaska 
(UTC-08:00) Baja California 
(UTC-08:00) Pacific Time (US and Canada) 
(UTC-03:30) Newfoundland
(UTC-03:00) Brasilia
(UTC-03:00) Greenland
(UTC-03:00) Cayenne, Fortaleza
(UTC-03:00) Buenos Aires
(UTC-03:00) Montevideo
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Default
Default
Scrollbar
Filtering - no input
Filtering - with input
Hover
Active/Selected
Disabled
The primary behavior of select inputs is to show a dropdown on click and swap the downwards pointing chevron with an upwards pointing one. 
Depending on the number of dropdown items, the behavior of both, select and dropdown input varies slightly:

8 or less entries: Default dropdown.
Many (8+) entries: Dropdown with scrollbar. 
Many/huge amount of entries AND users are familiar with options: Search bar, default dropdown. 

A good example for the filtering variant would be timezone selection, as it meets both criteria defined above: 
Huge amount of entries
Users are familiar with the options 
Time Zone
*
Search...
Time Zone
*
03:
Note:
Please avoid hiding important options. If 
user awareness of all options is critical, 
filtering should not be used. 
Dark mode
Optional label
*
Selected item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Default
Hover
Active/Selected
Disabled
Note:
For more details on 
variants, sizes and 
construction, please refer 
to the “Textfields” section 
on the left.
Dropdown items use the width of the select input, and have a fixed height. 
Medium, 40px height
Small, 32px height
Large, 48px height
Dropdown item
40
16px, Regular (400), line-height: 24px
Dropdown item
40
16px, Regular (400), line-height: 24px
Dropdown item
48
16px, Regular (400), line-height: 24px
Dropdown item
32
14px, Regular (400), line-height: 16px
Dropdown item
32
14px, Regular (400), line-height: 16px
Dropdown item
48
16px, Regular (400), line-height: 24px
12
12
8
8
16
16
12
12
8
8
16
16
8
8
8
8
12
8
8
8
8
8
8
12
12
12
This is the primary dropdown item size. Use other input sizes sparingly and only in dedicated areas.
Only use this size in combination with a small select input.
Only use this size in combination with a large select input.
Variable width
Variable width
Variable width
Variable width
Icon: 16px
Icon: 16px
Icon: 16px
Variable width
Variable width
Default
Default
Active
Active
Active
Icon swap: 
cancel/clear input


![Page 2](Ecosystem Design Guidelines - Mandatory Layer-3_page_002.png)

## Page 3

Label
24
16px, Regular (400), line-height: 24px;
Label
20
14px, Regular (400), line-height: 20px;
20
Inputs - Checkboxes/Radiobuttons/Toggles
Checkboxes
Radiobuttons
Toggle
This is the primary checkbox size. Use other sizes sparingly and only in dedicated areas.
This is the primary checkbox size. Use other sizes sparingly and only in dedicated areas.
This is the primary toggle size. Use other sizes sparingly and only in dedicated areas.
States
Sizes & construction
Sizes & construction
Sizes & construction
Medium
Medium
Medium
Small
Small
Small
Checkbox states vary depending on whether a box has been checked or not.
Radiobutton states vary depending on whether they are selected or not.
Label
Label
Label
Label
Label
Label
Label
Label
Label
Label
Label
Label
Label
Default, checked
Default, selected
On
Default, unchecked
Default, unchecked
Hover, checked
Hover, selected
Off
Hover, unchecked
Hover, unchecked
Press
Press
Disabled, on
Disabled, off
Disabled
Disabled
Indeterminate
Dark mode
Label
Label
Label
Label
Label
Label
Label
Default, checked
Default, unchecked
Hover, checked
Hover, unchecked
Press
Disabled
Indeterminate
Dark mode
Label
Label
Label
Label
Label
Label
Default, selected
Default, unchecked
Hover, selected
Hover, unchecked
Press
Disabled
Dark mode
On
Off
Disabled, on
Disabled, off
Label
Label
Label
Label
Label
24
16px, Regular (400), line-height: 24px;
Label
24
16px, Regular (400), line-height: 24px;
Label
24
16px, Regular (400), line-height: 24px;
Label
24
16px, Regular (400), line-height: 24px;
Label
20
14px, Regular (400), line-height: 20px;
20
Label
20
14px, Regular (400), line-height: 20px;
20
Label
20
14px, Regular (400), line-height: 20px;
20
Label
20
14px, Regular (400), line-height: 20px;
20
Stroke: 2px
Stroke: 2px
Stroke: 2px
Stroke: 2px
Icon: 16px
Icon: 12px
Icon: 12px
Icon: 12px
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
Note: 
This size may be used if space is an issue. Please try to use the 
primary checkbox size as much as possible. 
Note: 
This size may be used if space is an issue. Please try to use the 
primary radiobutton size as much as possible. 
Note: 
This size may be used if space is an issue. Please try to use the 
primary toggle size as much as possible. 
Label
Label
Label
Label
Dot: 16px
Dot: 12px
4px spacing
4px spacing
Overview
For each of the input types below, ready-to-use main components are provided: inputs/checkbox, inputs/radiobutton and inputs/toggle.
Label text can be toggled on/off as needed.


![Page 3](Ecosystem Design Guidelines - Mandatory Layer-3_page_003.png)

## Page 4

Inputs - Datepicker
Variants
States
Sizes & Construction
Quickselect bar
Calendar
Overview
Datepickers are a specialized type of input with a higher degree of complexity. Depending on the specific usecase, different variants can be 
implemented: 

Double month: Users tend to select large time periods, that often span over multiple months.
Single month: Users tend to select days or (predefined) time periods, often within the same month.    
Minimal: Users tend to select single days.
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
:
mm
to
hh
:
mm
Full day
Cancel
Confirm
DD.MM.YYYY
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
00
:
mm
00
to
hh
23
:
mm
59
Full day
Cancel
Confirm
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
:
mm
to
hh
:
mm
Full day
Cancel
Confirm
DD.MM.YYYY
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
00
:
mm
00
to
hh
23
:
mm
59
Full day
Cancel
Confirm
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
Today
Yesterday
This week
Last week
This month
Last month
Custom
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
:
mm
to
hh
:
mm
Full day
Aug 14, 2025, 00:00 to 23:59
Cancel
Confirm
Today
Yesterday
This week
Last week
This month
Last month
Custom
14.09.2025
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
16
:
mm
00
to
hh
18
:
mm
00
Full day
Aug 14, 2025, 00:00 to 23:59
Cancel
Confirm
Today
Yesterday
This week
Last week
This month
Last month
Custom
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
Full day
hh
:
mm
to
to
September
2025
Mo
Tu
We
Th
Fr
Sa
Su
1
2
3
4
5
6
7
8
9
10
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
1
2
3
4
5
hh
:
mm
Aug 20, 2025, 00:00 to Sep 12, 2025, 23:59
Cancel
Confirm
Today
Yesterday
This week
Last week
This month
Last month
Custom
20.08.2025
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
Full day
hh
00
:
mm
00
to
to
12.09.2025
September
2025
Mo
Tu
We
Th
Fr
Sa
Su
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
1
2
3
4
5
hh
23
:
mm
59
Aug 20, 2025, 00:00 to Sep 12, 2025, 23:59
Cancel
Confirm
Today
Yesterday
This week
Last week
This month
Last month
Custom
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
Full day
hh
:
mm
to
to
September
2025
Mo
Tu
We
Th
Fr
Sa
Su
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
1
2
3
4
5
hh
:
mm
- to -
Cancel
Confirm
Today
Yesterday
This week
Last week
This month
Last month
Custom
DD.MM.YYYY
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
Full day
hh
00
:
mm
00
to
to
DD.MM.YYYY
September
2025
Mo
Tu
We
Th
Fr
Sa
Su
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
1
2
3
4
5
hh
23
:
mm
59
- to -
Cancel
Confirm
Dark mode
Today
Yesterday
This week
Last week
This month
Last month
Custom
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
Full day
hh
:
mm
to
to
September
2025
Mo
Tu
We
Th
Fr
Sa
Su
1
2
3
4
5
6
7
8
9
10
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
1
2
3
4
5
hh
:
mm
Aug 20, 2025, 00:00 to Sep 12, 2025, 23:59
Cancel
Confirm
Today
Yesterday
This week
Last week
This month
Last month
Custom
20.08.2025
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
Full day
hh
00
:
mm
00
to
to
12.09.2025
September
2025
Mo
Tu
We
Th
Fr
Sa
Su
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
1
2
3
4
5
hh
23
:
mm
59
Aug 20, 2025, 00:00 to Sep 12, 2025, 23:59
Cancel
Confirm
Datepicker (Double)
Datepicker (Single)
Datepicker (Minimal)
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
:
mm
to
hh
:
mm
Full day
Cancel
Confirm
DD.MM.YYYY
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
00
:
mm
00
to
hh
23
:
mm
59
Full day
Cancel
Confirm
Today
Yesterday
This week
Last week
This month
Last month
Custom
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
:
mm
to
hh
:
mm
Full day
Aug 14, 2025, 00:00 to 23:59
Cancel
Confirm
Today
Yesterday
This week
Last week
This month
Last month
Custom
14.09.2025
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
16
:
mm
00
to
hh
18
:
mm
00
Full day
Aug 14, 2025, 00:00 to 23:59
Cancel
Confirm
Datepicker (Double month)
Datepicker (Single month)
Datepicker (Minimal)
Datepicker (Minimal)
Datepicker (Double month)
Default
Hover
Press
Active
Disabled
Calendar days can have the following states: 

Default
Hover
Selected (Start/End)
Range
Disabled

The current day is bold and underlined, but otherwise has the same states.
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
31
1
2
3
4
5
6
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
:
mm
to
hh
:
mm
Full day
Cancel
Confirm
31
1
2
3
4
5
6
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
:
mm
to
hh
:
mm
Full day
Cancel
Confirm
11
12
13
14
15
16
17
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
:
mm
to
hh
:
mm
Full day
Cancel
Confirm
11
12
13
14
15
16
17
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
:
mm
to
hh
:
mm
Full day
Cancel
Confirm
11
12
13
14
15
16
17
Dark mode
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
31
1
2
3
4
5
6
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
:
mm
to
hh
:
mm
Full day
Cancel
Confirm
31
1
2
3
4
5
6
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
:
mm
to
hh
:
mm
Full day
Cancel
Confirm
11
12
13
14
15
16
17
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
:
mm
to
hh
:
mm
Full day
Cancel
Confirm
11
12
13
14
15
16
17
August
2025
Mo
Tu
We
Th
Fr
Sa
Su
28
29
30
31
1
2
3
4
5
6
7
8
9
10
11
12
13
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
hh
:
mm
to
hh
:
mm
Full day
Cancel
Confirm
11
12
13
14
15
16
17
Current day
Disabled
Any day
Any day
Any day
End
Range
Current day
Current day
Start
Default
Hover
Selected (Single)
Selected (Range)
Current day
Disabled
Any day
Any day
Any day
End
Range
Current day
Current day
Start
Default
Hover
Selected (Single)
Selected (Range)
12
12
12
12
12
8
8
8
8
8
8
12
12
12
12
12
12
12
24
40
40
12
12
12
12
12
8
8
12
12
16
8
Today
Yesterday
This week
Last week
This month
Last month
Custom
Note: 
Quickselect items are styled like small (32px) 
secondary buttons, but without a border. 

In addition, they have an active state.
Quickselect item
32
Montserrat Semibold (600), 12px, lh: 16px
August
2025
40
August
2025
1
40
1
Default
Month/Year selection
Day
Default
Selection dropdown
8
8
Icon: 16px
Icon: 12px
Icon: 12px
Icon: 16px
24
8
8
24
16
16
2025
2024
2023
2022
2021
2020
Dropdown item size: Small
corner-radius: 4px;
font: 16px, Regular (400), line-height: 24px;
No input: Calendar icon
Input: X/Cancel icon


![Page 4](Ecosystem Design Guidelines - Mandatory Layer-3_page_004.png)

