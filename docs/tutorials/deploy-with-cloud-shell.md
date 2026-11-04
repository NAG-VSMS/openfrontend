# Deploy the Open Front End from Cloud Shell

<walkthrough-tutorial-duration duration="40"></walkthrough-tutorial-duration>

This guided tutorial deploys the Open Front End (OFE) for the Google Cloud
Cluster Toolkit into a project of your choice, entirely from Cloud Shell. You
do not need to install anything: Cloud Shell already has `git`, Terraform and
the Google Cloud CLI, and it is signed in as you.

By the end you will have:

- a running Front End on its own small VM, the *service machine*
- a service account credential registered in it
- a first VPC network and Filestore filesystem
- a Slurm cluster in the *ready* state, waiting for applications and jobs

**Cost.** The service machine, its Cloud Storage bucket and a Filestore
instance bill from the moment they exist. The cluster's controller and login
nodes bill while the cluster exists; compute nodes bill only while jobs run.
The last step shows how to remove everything.

**Reading this on openfrontend.org?** The widgets and buttons below only
appear inside Cloud Shell. Click the button to open Cloud Shell with this
tutorial loaded in its side panel:

[![Open in Cloud Shell](https://www.gstatic.com/cloudssh/images/open-btn.svg)](https://shell.cloud.google.com/cloudshell/editor?cloudshell_git_repo=https://github.com/NAG-VSMS/openfrontend&cloudshell_git_branch=main&cloudshell_tutorial=docs/tutorials/deploy-with-cloud-shell.md&cloudshell_workspace=.&show=terminal)

Cloud Shell will ask you to confirm cloning this repository. If it tells you
the repository is not trusted and opens a *temporary* environment, prefer the
manual route instead, so the deployment's Terraform state lands in your
persistent home directory: open [Cloud Shell](https://shell.cloud.google.com/)
and paste:

```bash
git clone https://github.com/NAG-VSMS/openfrontend.git && teachme openfrontend/docs/tutorials/deploy-with-cloud-shell.md
```

<!--
Upstream note: when this file lives in the Cluster Toolkit repository, replace
the paragraph above with an "Open in Cloud Shell" button pointing at
cloudshell_git_repo=https://github.com/GoogleCloudPlatform/cluster-toolkit
and cloudshell_tutorial=community/front-end/ofe/docs/tutorial.md. Such
a button opens the user's own Cloud Shell only for Google-owned repositories.
-->

## Choose a project

The Front End is deployed into a Google Cloud project that has billing
enabled. Pick an existing project or create a new one:

<walkthrough-project-setup billing="true"></walkthrough-project-setup>

Your account needs to be an **Owner** of the project. An Editor also works;
anything narrower needs the roles listed in the
[Admin Guide](../admins/admin_guide.md#gcp-user).

Confirm that Cloud Shell is now pointing at the project you chose:

```bash
gcloud config get-value project
```

If it prints a different project, set it explicitly:

```bash
gcloud config set project YOUR_PROJECT_ID
```

<walkthrough-footnote>Cloud Shell is pre-authenticated as the Google account
you are signed in with, so no `gcloud auth login` is needed.</walkthrough-footnote>

## Enable the APIs

The deployment script needs the following services. Enable them in one go:

<walkthrough-enable-apis apis="compute.googleapis.com,monitoring.googleapis.com,logging.googleapis.com,pubsub.googleapis.com,cloudresourcemanager.googleapis.com,iam.googleapis.com,oslogin.googleapis.com,file.googleapis.com,cloudbilling.googleapis.com,storage.googleapis.com,serviceusage.googleapis.com,servicenetworking.googleapis.com,secretmanager.googleapis.com,sqladmin.googleapis.com,bigqueryconnection.googleapis.com,aiplatform.googleapis.com"></walkthrough-enable-apis>

If the button is not available where you are reading this, the same list can
be enabled from the terminal:

```bash
gcloud services enable compute.googleapis.com monitoring.googleapis.com logging.googleapis.com pubsub.googleapis.com cloudresourcemanager.googleapis.com iam.googleapis.com oslogin.googleapis.com file.googleapis.com cloudbilling.googleapis.com storage.googleapis.com serviceusage.googleapis.com servicenetworking.googleapis.com secretmanager.googleapis.com sqladmin.googleapis.com bigqueryconnection.googleapis.com aiplatform.googleapis.com
```

The deploy script checks this list again and offers to enable anything that is
missing, so nothing breaks if you skip ahead.

## Get the code

The Open Front End lives inside the Cluster Toolkit repository. Clone it into
your Cloud Shell home directory and move into the Front End folder:

```bash
git clone https://github.com/GoogleCloudPlatform/cluster-toolkit.git
cd ~/cluster-toolkit/community/front-end/ofe
```

Everything that follows runs from this directory. Your Cloud Shell home
directory persists between sessions, which matters later: the `tf` folder
created here is what the teardown script uses to remove the deployment.

## Run the deployment script

Start the interactive deployment:

```bash
./deploy.sh
```

The script asks a short series of questions. Suggested answers for a first
deployment:

| Prompt | What to enter |
| --- | --- |
| Deployment name | A short name such as `ofe-demo`. It prefixes the resources that are created. |
| GCP project ID | The project you chose in step 1. Use the project *ID*, not its display name. |
| GCP zone | Any zone, for example `europe-west2-a`. Clusters can live in other zones later. |
| GCP subnet name | Press Enter. A subnet is created for you. |
| DNS hostname | Press Enter for a test deployment. The Front End is then served over plain HTTP on its IP address. Give a hostname you control to get HTTPS via Let's Encrypt. |
| Static IP address | Press Enter. An address is allocated for you. |
| Admin username, password, email | The Django superuser you will log in with. Keep the password somewhere safe. |
| Create a service account and credential? | `y`. The script creates a service account with the roles the Front End needs and writes `credential.json` next to the script. |
| Deployment method | `1`, clone the git repository when the server deploys. |

Review the summary and confirm. Terraform then creates the service machine,
a Cloud Storage bucket and a Pub/Sub topic. This takes a few minutes and ends
with a line like:

```text
server_ip = "34.xx.xx.xx"
```

Note that address. The script also prints a reminder that the Front End's own
software stack keeps installing for up to 15 minutes after Terraform finishes.

<walkthrough-footnote>Keep this Cloud Shell tab open and active while
Terraform runs. Cloud Shell ends sessions after a period of inactivity, and
the script cannot resume an interrupted run.</walkthrough-footnote>

## Wait for the service machine

The VM is up, but Django, nginx and the Cluster Toolkit are still being
installed on it. You can watch for the moment the web server starts answering:

```bash
SERVER_IP=$(cd tf && terraform output -raw server_ip); echo "Waiting for http://${SERVER_IP}/ ..."; until curl -s -o /dev/null -w '%{http_code}' "http://${SERVER_IP}/" | grep -q '^[23]'; do printf '.'; sleep 20; done; echo; echo "Ready: http://${SERVER_IP}/"
```

If nothing answers after 20 minutes, open the VM's serial console output in
the Google Cloud console (Compute Engine, VM instances, the instance named
after your deployment, *Serial port 1*) to see where the startup script got
to. The [Admin Guide](../admins/admin_guide.md#troubleshooting) covers the
common causes.

## Log in and register the credential

Open `http://SERVER_IP/` in a browser and sign in with the admin username and
password you gave the script. (Only the Django superuser uses this login. Your
users will sign in with Google once you configure OAuth, which is covered in
the [Admin Guide](../admins/admin_guide.md#setup-google-oauth2-login).)

The Front End creates cloud resources with a service account, so it needs that
account's key. The script already generated it. Open the file in the Cloud
Shell editor and copy its entire contents:

```bash
cloudshell edit credential.json
```

In the Front End, go to **Credentials**, click **Add**, give it a name such as
`default`, paste the JSON into the form and click **Validate and Save**.

<walkthrough-footnote>Treat `credential.json` as a secret: it grants the
roles the Front End uses to create and destroy resources in your project.
Delete the local copy once it is registered if you prefer.</walkthrough-footnote>

## Create a network and a filesystem

Clusters need a VPC network and a shared filesystem. Both are created from
the Front End and both outlive any cluster, so you create them once.

1. Go to **Networks**, click **Add**, choose the credential you just
   registered, give the VPC a name and pick a region, then save.
2. Click **Edit Subnet** and add one subnet in that region.
3. Click **Apply Cloud Changes** and wait for the status to show the network
   is ready.
4. Go to **Filesystems**, click **Add**, choose the credential and the subnet
   you just created, and create a Filestore instance. It takes a few minutes
   to become ready.

Details and the import options for existing networks and NFS servers are in
the [Admin Guide](../admins/admin_guide.md#network-management).

## Create your first cluster

1. Go to **Clusters** and click **Add**.
2. Give the cluster a name using lower-case letters, digits and hyphens, pick
   the subnet you created, a zone in its region, and tick yourself under
   **Authorised users**. Save.
3. Click **Edit** to review the configuration. The two shared filesystems are
   already mounted. One partition of `c2-standard-60` nodes is defined; keep
   it, or change the machine type to something smaller for a first test.
4. Save, then click **Create**.

The status moves from *creating* (Terraform is provisioning the controller and
login nodes) to *initialising* (Slurm and the Front End's agent are being
configured) to *ready*. Expect 15 to 20 minutes. Logs are available from the
cluster's page throughout.

You now have a working cluster. The [Application Guide](../admins/application_guide.md)
shows how to install software with Spack, and the
[User Guide](../users/user_guide.md) covers submitting jobs.

## Clean up

Resources created from the Front End are not removed by the teardown script,
so destroy them in the web interface first, in this order:

1. **Clusters**: from the cluster's **Actions** menu choose **Destroy** and
   wait for the *destroyed* state.
2. **Workbenches**, if you created any.
3. **Filesystems**: delete the Filestore instance.
4. **Networks**: delete the VPC.

Then, back in the same directory in Cloud Shell, remove the Front End itself:

```bash
cd ~/cluster-toolkit/community/front-end/ofe && ./teardown.sh
```

Finally, if you no longer need the service account the script created, delete
it from **IAM & Admin, Service accounts** in the Google Cloud console, or
delete the whole project if it was created only for this tutorial.

<walkthrough-footnote>Cloud Shell deletes a home directory after 120 days
without use. If a deployment may outlive that, copy the `tf` folder to a
bucket, or keep a copy of the deployment name, project and zone so the
resources can be removed by hand.</walkthrough-footnote>

## Congratulations

You deployed the Open Front End, registered a credential and brought up a
Slurm cluster without writing a line of Terraform.

Where next:

- [Application Guide](../admins/application_guide.md): install applications
  with Spack or custom scripts.
- [User Guide](../users/user_guide.md): submit jobs, use Cloud Storage for
  input and output, open a remote desktop.
- [Admin Guide](../admins/admin_guide.md#setup-google-oauth2-login): switch on
  Google login so your users can sign in.
- [Advanced Admin Guide](../admins/advanced_admin_guide.md): deploy in one
  project and manage resources in others, or use least-privilege roles.
- Need a hand with a production deployment? [Contact NAG](https://www.nag.com/contact-us).
