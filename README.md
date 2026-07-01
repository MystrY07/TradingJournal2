# Trading Journal

A desktop trading journal application developed in **Java Swing** that allows users to record, organise, and review their trades. The project was created to practice object-oriented programming, file handling, and GUI development while building a practical tool for tracking trading activity.

---

## Features

- Record trade date and time
- Log contract quantity and instrument
- Attach screenshots to journal entries
- Automatically save journal entries
- Load previous journal entries on startup
- Store data locally without a database
- Simple desktop interface built with Java Swing

---

## Technologies

- Java
- Java Swing
- Java Object Serialization
- Java File I/O
- Apache Ant
- NetBeans

---

## Project Structure

```text
TradingJournal2
│
├── src/
│   └── tradingjournal/
│       └── TradingJournal.java
│
├── journal_images/
├── trades.dat
├── build.xml
└── manifest.mf
```

---

## Getting Started

### Clone the repository

```bash
git clone https://github.com/MystrY07/TradingJournal2.git
```

### Run the project

Open the project in NetBeans and run:

```text
TradingJournal.java
```

or build using Ant:

```bash
ant run
```

---

## Data Storage

The application stores data locally using Java object serialization.

- `trades.dat` stores all journal entries.
- `journal_images/` stores screenshots attached to trades.

No external database is required.

---

## Learning Objectives

This project was developed to strengthen my understanding of:

- Object-oriented programming
- Java Swing GUI development
- Event-driven programming
- File handling and object serialization
- Building desktop applications

---

## Future Improvements

Some features I would like to add in future versions include:

- Profit and loss tracking
- Win rate statistics
- Risk-to-reward calculations
- Search and filtering
- Edit and delete journal entries
- CSV export
- Performance dashboard
- Dark mode

---

## Screenshots

### Main Window

<img width="1880" height="852" alt="image" src="https://github.com/user-attachments/assets/1673c973-7815-4028-a163-d70bcf344d8d" />

### Trade Entry

<img width="1017" height="830" alt="image" src="https://github.com/user-attachments/assets/a8093519-dac8-4bdd-b4fe-657cae6d311d" />

---

## Author

**Andrei Orprecio**

Third Year BSc (Hons) in Computing  
NCI

GitHub: https://github.com/MystrY07
