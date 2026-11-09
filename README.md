# LMS-SIA (MS Teams × Google Classroom)

A full-stack Learning Management System built with **React (Vite)**, **Supabase (PostgreSQL & Storage)**, and **Vanilla CSS**, ready for **Vercel** deployment.

## Key Features
- **Role-Based Sign In / Sign Up Gate**:
  - Choose **Student (`'s'`)** or **Admin (`'t'`)** before signing in or creating an account in table `u`.
  - Once signed in, the user's role is strictly locked for their session (no role-switching toggle inside the dashboard) until they click **Sign Out**.
- **Clean Database (Zero Placeholders)**:
  - Starts completely empty so the first Admin and Students manipulate all classes (`c`), assignments (`a`), submissions (`s`), and users (`u`) directly in Supabase.
- **Admin Role (`'t'`)**:
  - Create and switch between classes in table `c`.
  - Publish and delete assignments in table `a`.
  - Inspect student `.ppt` / `.pptx` submissions in table `s`, open files from Storage bucket `'b'`, and record grades.
- **Student Role (`'s'`)**:
  - Browse the class Stream and Classwork feed.
  - Upload `.ppt` / `.pptx` presentations and exercises via `multipart/form-data` directly to Supabase Storage bucket `'b'` and record submissions in table `s`.
