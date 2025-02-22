const validator = require("validator");
const sanitizeHtml = require("sanitize-html");
const { ObjectId } = require("mongodb");
const nodemailer = require("nodemailer");
const petsCollection = require("../db").db().collection("pets");
const contactsCollection = require("../db").db().collection("contacts");

const sanitizeOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

exports.submitContact = async function (req, res, next) {
  if (req.body.secret.toUpperCase() !== "PUPPY") {
    console.log("spam detected");
    return res.json({ message: "Spam detected" });
  }

  if (typeof req.body.name !== "string") {
    req.body.name = "";
  }

  if (typeof req.body.email !== "string") {
    req.body.email = "";
  }

  if (typeof req.body.comment !== "string") {
    req.body.comment = "";
  }

  if (validator.isEmail(req.body.email) === false) {
    console.log("invalid email detected");
    return res.json({ message: "invalid email detected" });
  }

  if (!ObjectId.isValid(req.body.petId)) {
    console.log("invalid id detected");
    return res.json({ message: "Spam detected" });
  }

  req.body.petId = new ObjectId(req.body.petId);

  const doesPetExist = await petsCollection.findOne({
    _id: req.body.petId,
  });

  if (!doesPetExist) {
    console.log("pet does not exist!");
    return res.json({ message: "pet does not exist" });
  }

  const ourObject = {
    petId: req.body.petId,
    name: sanitizeHtml(req.body.name, sanitizeOptions),
    email: sanitizeHtml(req.body.email, sanitizeOptions),
    comment: sanitizeHtml(req.body.comment, sanitizeOptions),
  };

  console.log(ourObject);

  let transport = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: process.env.MAILTRAPUSERNAME,
      pass: process.env.MAILTRAPPASSWORD,
    },
  });

  try {
    const promise1 = transport.sendMail({
      to: ourObject.email,
      from: "petadoption@localhost",
      subject: `Thank you for your interest in ${doesPetExist.name}`,
      html: `<h3>Thank you for contact us</h3>
      <p>We appreciate your interest in ${doesPetExist.name} and our staff will get back to you</p>
      <p><em>${ourObject.comment}</em></p>`,
    });

    const promise2 = transport.sendMail({
      to: "petadoption@localhost",
      from: "petadoption@localhost",
      subject: `Someone is interested in ${doesPetExist.name}`,
      html: `<h3>New Contact!</h3>
      <p>Name: ${ourObject.name}<br>
      Pet interested in : ${doesPetExist.name}<br>
      Email: ${ourObject.email}<br>
      Message: ${ourObject.comment}
      </p>`,
    });

    const promise3 = await contactsCollection.insertOne(ourObject);

    await Promise.all([promise1, promise2, promise3]);
  } catch (err) {
    next(err);
  }

  res.send("Thanks for sending data to us");
};

exports.viewPetContacts = async function (req, res) {
  if (!ObjectId.isValid(req.params.id)) {
    console.log("invalid ID");
    return res.redirect("/");
  }

  const pet = await petsCollection.findOne({
    _id: new ObjectId(req.params.id),
  });

  if (!pet) {
    console.log("pet not found");
    return res.redirect("/");
  }

  const contacts = await contactsCollection
    .find({
      petId: new ObjectId(req.params.id),
    })
    .toArray();

  res.render("pet-contacts", {
    contacts,
    pet,
  });
};
