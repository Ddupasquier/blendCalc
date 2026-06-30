Smoothie Notes

* Export / Share Recipe: Generate a plain text recipe with ingredient amounts and nutrient totals.
- In addition to barcode scanning, should we add the ability to just take a picture of the nute facts on custom ingredients?

- Add some kind of social media aspect. Like users can submit their mixture to a shared page that all users can see, upvote, downvote, save to their own list, etc.This would include user who submits mixture adding a description, and additional or necessary steps, what have you.
	- trending page
	- new
	- top picks (best for protein, calories, carbs, etc)
	- Any suggestions from the AI?
- Also, where is all the api code? This stuff should be readily accessible and easy to find. What apis and stuff are we making fetches to? Separate those different calls by api name specifically.
- Sometimes I have to refresh page so tab label can be accurate to which tab I’m on
￼
- Find a way to add photos to ingredients. Is there an API we can use for this?
- For wider screens, we should figure out some breakpoints so the UI can be less long. If a user is managing their stuff on a desktop, they should get a desktop experience.
* Finish your othre tasks before this. If we find information that should be in the DB then we need to go ahead and write it to the DB. Run like 200 examples and then save EVERYHTING that we legally can just add to our own information bank.
* Run a full audit over all of the available APIs. You can do this using an existing script OR you can make a new one. From the output of those scripts, tell me if there is additional information we should be storing in our DB. I don't want to be sleeping on information that I didn't know was available that we could be leveraging in this app.
* Make all fonts a bit bigger. This is impossible to read. If there is a best practice for mobile devices on component size, font size, etc. then please follow it.
* Is there an extension I can be using to see my supabase schema in VScode?
* Make sure there are no constants in this app that should be run from the DB. I want to avoid pointless hard coding. If we need data, we go get it. If we need more information then we explore new API avenues. That data then gets backed up to our DB. Period.
* Liquid ingredient checkbox should be a toggle. That toggle should be a reusable component.
* + button in ingredients should be set a bit higher than it is. Make it equal to whatever the “right” math is.
* Share with community should be a toggle
* Let’s make the ingredient cards look like figma
* Just make fridge and shopping lists infinite scroll. The Load function is obviously not working well and it seems like we’re fetching all of the information in the beginning anyways. My intention was to not have to fetch ALL info from the start. But if it’s not gonna be too heavy then fuck it, right?
* Name change to blendCalc
* General shape for components that require roundover in 1rem. Make sure this is refelcted in the scss variables.
* On further views, what I think we should do is basically start from scratch. Make all new components if we don’t have reusable ones that we’re currently using. The whole view should just be build from the ground up. Trying to repurpose existing components has been a hassle. We make the new component and THEN plug in the functionality from the old components. Create UI > Audit if current flow works with new UI > If current available data works for new UI then plug in existing data points and functionality to new components > Test > Delete old components

END GAME:- Do a full accessibility audit
- Fully update and beef up readme, but remove shit that is just purely overexplaining
- Beef up the tutorial, remove the 7 days prompt, make it available in the profile section if user needs to refer back to it, add “I” informational that are clickable and bring up the tutorial in the section that is needed when those informs are clicked.

Pre Note:Always first referring to the development rules, please add these changes.If there is something that intersects with the dev rules then please say something. If there is something in the dev rules that goes against what I’ve said or something seems off or against best practices then pause and we discuss.This is to always be DB driven. If we don’t have the data in the DB then we should discuss how to add it to the DB.Keep in mind licensing issues, as I don’t want to be stealing data that I’m not authorized to be storing.Instead of using an md file, can you create new github issues that help me to track what I nee to test?
