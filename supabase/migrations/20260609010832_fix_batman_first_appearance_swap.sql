-- Batman (69, Bruce Wayne) and Batman Beyond (70, Terry McGinnis) had their
-- first_appearance values swapped. Correct them.
update heroes set first_appearance = 'Detective Comics #27' where id = '69';
update heroes set first_appearance = 'Batman Beyond #1' where id = '70';
