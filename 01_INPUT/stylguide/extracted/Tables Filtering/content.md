# Ecosystem Design Guidelines - Mandatory Layer-4

## Page 1

Traffic Light Controllers
Add controller
4
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
2
Section Value
Section Value
Section Value
Section Value
Section Value
Actions
Entries per page
5
/ 1280
48
/ 256
Last updated: 10 minutes ago
4
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
2
Section Value
Section Value
Section Value
Section Value
Section Value
Actions
Entries per page
5
/ 1280
48
/ 256
Last updated: 10 minutes ago
Tables
Overview
Sizes & construction
Table controls
Table header
Pagination
Scrolling
Sizes & construction
Table data
Medium (default)
Large
Small
Variable row height
Tables are the primary choice for displaying complex data. 
While their functionality may vary, their layout and styling must be consistent across 
the entire ecosystem. 

Tables always use 100% of the available horizontal screenspace.
Table controls allow the user to apply global table settings or search the table for specific entries. Such function may include, but are not limited to:

change the row height
show/hide certain columns
save the current view (only applicable if users can change one or more global settings) or 
download table data. 
The table header provides access to column-specific functions. Such functions may include, but are not limited to: 

sort  (ascending, descending, none) 
filter (e.g. for certain device states) or 
lock a column, when horizontal scrolling is necessary to see all data. 
The pagination allows users to quickly navigate longer lists of entries and provides an overview over their total amout. It houses various functions: 

define entries per page (select input with predefined values, e.g. 5, 10, 25, 50, 100 ) 
jump to first/last page
go to previous/next page
jump to specific page, (textfield where users can input specific page numbers )

In addition, the pagination provides information on when the viewed data was last updated. 
Tables with many columns require horizontal scrolling. In this case, the scrollbar is placed below the table data. Additionally, a dropshadow is added 
to the left side of the “Actions” column, to indicate that additional content is hidden. 

The “Action” column position is fixed and the column is always visible. Should the column be omitted, the dropshadow is added to the left side of the 
table. 
You may provide entry-based functionality to the user. These “actions” may include, but are not limited to: 

lock a specific row (if vertical scrolling is necessary)
edit an entry (quick edit)
delete an entry or 
open detail page. 
As mentioned above, the height of the rows can be adjusted by users, if you decide to implement such a 
feature. Users can then choose between 3 different row heights: 

Small
Medium (default)
Large

While the vertical spacings differ for each version, horizontal spacings remain untouched.
Important note for designers: 
As you all are aware, designing flexible tables in figma is tricky without 
relying on custom plugins. The current approach is column-centered 
and uses Table/Header and Table/Data components to help you build 
tables quickly and in a consistent way. 

Additionally, Table/Controls and Table/Pagination components are 
provided. The samples below show the intended construction.
Note: 
Medium is the default row height. If you don’t offer 
variable row heights, you must choose this size. 
Note: 
The table header is not affected by line 
height changes.
Traffic Light Controllers
Add controller
4
2
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
2
Section Value
Section Value
Section Value
Section Value
Section Value
Actions
Entries per page
5
/ 1280
48
/ 256
Last updated: 10 minutes ago
Save current view
Traffic Light Controllers
Add controller
4
Entries per page
5
/ 1280
48
/ 256
Last updated: 10 minutes ago
14px, Regular (400), lh 20px 
5
/ 1280
48
/ 256
Last updated: 10 minutes ago
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
Section Value
16px, Bold (700), lh: 24px
Section Value
Section Value
16px, Regular (400), lh: 24px
Section Value
Section Value
16px, Bold (700), lh: 24px
Section Value
Section Value
Section header
Section header
Section header
2
Actions
16px, Bold(700)
lh: 24px
Section header
Actions
16px, Bold(700)
lh: 24px
Section header
Actions
16px, Bold(700)
lh: 24px
Section header
Actions
24px, Bold (700), lh 32px
Add controller
Save current view
12
12
12
12
12
12
12
12
24
72
40
40
56
32
40
40
24
40
40
40
40
40
24
40
40
40
40
40
40
40
40
40
40
40
24
40
40
24
24
16
16
8
8
8
8
8
8
24
40
32
8
8
8
16
8
16
8
16
16
16
16
8
8
8
16
8
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
8
8
8
8
8
8
8
Icons: 16px
Icons: 16px
The action column is always right-aligned. 
Its width depends on the number of action icons.
Icons: 16px
Icons: 16px
Icons: 16px
Medium
Medium
Medium
Medium
Primary, medium
Small
Hover
Secondary, small
Small
Small
24
24
24
24
24
24
24
24
24
24
24
24
24
24
24
24
24
24
24
24
24
24
24
24
24
24
24 24 24
Table controls
Overall display setting
Table header
Column-based functions
Table data
Entry/row-based functions
Pagination
horizontally centered
Dark mode
Traffic Light Controllers
Add controller
4
2
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
2
Section Value
Section Value
Section Value
Section Value
Section Value
Actions
Entries per page
5
/ 1280
48
/ 256
Last updated: 10 minutes ago
Save current view
Dark mode
Traffic Light Controllers
Add controller
4
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
2
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
2
Section Value
Section Value
Section Value
Section Value
Section Value
Entries per page
5
/ 1280
48
/ 256
Last updated: 10 minutes ago
Scrolling (with Action column)
Scrolling (without Action column)
Traffic Light Controllers
Add controller
4
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
2
Section Value
Section Value
Section Value
Section Value
Section Value
Actions
Entries per page
5
/ 1280
48
/ 256
Last updated: 10 minutes ago
Traffic Light Controllers
Add controller
4
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
2
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
2
Section Value
Section Value
Section Value
Section Value
Section Value
Entries per page
5
/ 1280
48
/ 256
Last updated: 10 minutes ago
Scrolling (with Action column)
Scrolling (without Action column)
drop-shadow: 24px, 0px offset
no additional spacing between
scrollbar and pagination
scrollbar height: 8px
Column spacing
The default spacing for columns is 40px. For tables with many columns, this spacing may be reduced to 24px.
Section header
Section header
Section header
2
Actions
Section header
Section header
Section header
2
Actions
Default column spacing (40px)
Narrow column spacing (24px)


![Page 1](Ecosystem Design Guidelines - Mandatory Layer-4_page_001.png)

## Page 2

Tables - Filtering
Overview
Sizes & construction
Variants
Medium (default)
Tables can be filtered to display a subset of data. Filtering options may vary depending on the:

type of data (e.g. predefined options VS free search; single- VS multiselect, ) and/or 
level of the filtering (e.g. filter section/column items VS show/hide specific table columns).

Filter dropdowns use the same sizes and styling like input select dropdowns, but integrate the text input 
field as part of the dropdown. They feature a small arrow that points to the active function icon.
This is the primary dropdown size. All individual dropdown items and buttons are medium-sized.
Note: 
For more details on sizes and styling of the 
individual dropdown items, please visit the 
Inputs section. 
Note: 
For more details on sizes and construction of 
the individual dropdown items, please visit 
the Inputs/Datepicker section. 
Traffic Light Controllers
Add controller
4
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
2
Section Value
Section Value
Section Value
Section Value
Section Value
Actions
Entries per page
5
/ 1280
48
/ 256
Last updated: 10 minutes ago
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Cancel
Apply
Search...
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Cancel
Apply
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Search...
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
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
16:30 to 18:00
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
16
:
mm
30
to
hh
18
:
mm
00
Full day
16:30 to 18:00
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
Search...
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Cancel
Apply
Search...
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Cancel
Apply
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Cancel
Apply
Search...
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Cancel
Apply
12
12
12
12
16
12
Dark mode
Traffic Light Controllers
Add controller
4
4
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
Section Value
Section Value
Section Value
Section Value
Section Value
Section header
2
Section Value
Section Value
Section Value
Section Value
Section Value
Actions
Entries per page
5
/ 1280
48
/ 256
Last updated: 10 minutes ago
Save current view
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Cancel
Apply
Search...
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Dropdown item
Cancel
Apply
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
Single Select
Datepicker (Double)
Datepicker (Single)
Datepicker (Minimal)
Input only
Multi Select
stroke: 1px; 
corner-radius: 4px;
drop-shadow: 24px, 0px offset


![Page 2](Ecosystem Design Guidelines - Mandatory Layer-4_page_002.png)

