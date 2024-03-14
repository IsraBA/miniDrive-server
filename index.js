const express = require('express');
const multer = require('multer');
const fs = require('fs');
const sizeOf = require('image-size')
const app = express();
const sharp = require('sharp');

// #region בחירת שם מותאם אישית לקבצים באמצעות ספריית מולטר
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
})

const upload = multer({ storage: storage })
// #endregion


const cors = require('cors');
const path = require('path');
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    try {
        const filesNames = fs.readdirSync('./uploads');
        const sizes = filesNames.map(filename => fs.statSync('./uploads/' + filename).size);
        const resolution = filesNames.map(filename => sizeOf(path.join('./uploads', filename)));
        const originalDetails = [filesNames, sizes, resolution];
        const filesDetails = originalDetails[0].map((file, i) => {
            const fileSizeInBytes = originalDetails[1][i];
            let fileSizeDisplay;

            if (fileSizeInBytes > 102400) { // Over 100 kilobytes, display in megabytes
                const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
                fileSizeDisplay = fileSizeInMB.toFixed(2) + "MB";
            } else {
                const fileSizeInKB = fileSizeInBytes / 1024;
                fileSizeDisplay = fileSizeInKB.toFixed(2) + "KB";
            }
            return [
                originalDetails[0][i],
                fileSizeDisplay,
                originalDetails[2][i]
            ];
        })
        res.send(filesDetails);
    } catch (error) {
        res.status(500).send(error || "something went wrong")
    }
})

app.get('/images', async (req, res) => {
    try {
        const filesNames = fs.readdirSync('./uploads');

        // עיבוד כל תמונה לתצוגה מקדימה
        const previews = await Promise.all(filesNames.map(async (fileName) => {
            const imagePath = path.join('./uploads', fileName);
            // שמירה של התצוגה מקדימה בתיקיית התצוגות המקדימות
            const previewPath = path.join('./previews', fileName);

            // יצירת התצוגה המקדימה אם לא קיימת בתיקייה
            if (!fs.existsSync(previewPath)) {
                await sharp(imagePath)
                    .resize({ height: 300, width: 300, fit: 'cover' })
                    .jpeg({ quality: 85 })
                    .toFile(previewPath);
            }
            // לצורך שליחתן לקליינט buffer המרה של התמונות תצוגה מקדימה לקוד 
            const previewBuffer = await fs.promises.readFile(previewPath);

            return {name: fileName, previewImage: previewBuffer};
        }))

        res.send(previews);

    } catch (error) {
        res.status(500).send(error || "something went wrong")
    }
})

app.get('/image/:imageName', async (req, res) => {
    try {
        const imagePath = path.join('./uploads', req.params.imageName);

        // זיהוי סוג התמונה לצורך זיהוייה בקליינט
        const metadata = await sharp(imagePath).metadata();
        const imageType = metadata.format;
        if (!imageType) {
            return res.status(500).send("Error getting image type");
        }
        res.setHeader('Content-Type', `image/${imageType}`);
        
        // המרה של התמונה לבאפר ושליחתה לשרת
        const stream = fs.createReadStream(imagePath);
        stream.pipe(res);
    } catch (error) {
        res.status(500).send(error || "something went wrong");
    }
})

app.post('/', upload.array('file'), (req, res) => {
    try {
        // console.log('file: ', req.files, "body: ", req.body);
        res.send("success");
    } catch (error) {
        res.status(500).send(error || "something went wrong");
    }
})

app.get('/download/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        res.download('./uploads/' + filename, (err) => {
            if (err) {
                res.status(500).send("file not found");
            }
        })
    } catch (error) {
        res.status(500).send(error || "something went wrong");
    }
});

app.put('/rename/:filename', (req, res) => {
    try {
        const currentName = req.params.filename;
        const newName = req.body.newName;

        if (!newName) {
            res.status(400).send('New filename is required');
            return;
        }

        const currentPath = path.join('./uploads', currentName);
        // הגדרת השם החדש פלוס הסיומת הקיימת
        const parsed = path.parse(currentName);
        const newPath = path.join('./uploads', newName + parsed.ext);

        fs.renameSync(currentPath, newPath, (err) => {
            if (err) {
                res.status(500).send('Error renaming file');
            }
        })
        res.send('file renamed from ' + currentName + ' to ' + newName + parsed.ext);
    } catch (error) {
        res.status(500).send(error || "something went wrong");
    }
});

app.delete('/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const fileToDelete = path.join('./uploads', filename);

        fs.unlinkSync(fileToDelete, (err) => {
            if (err) {
                res.status(500).send('Error deleting file');
            }
        })
        res.send('this file deleted: ' + filename);
    } catch (error) {
        res.status(500).send(error || "something went wrong");
    }
});

app.get('*', (req, res) => {
    res.status(404).send("path not found");
})


app.listen(2300, () => console.log("****server is listening on port 2300****"))